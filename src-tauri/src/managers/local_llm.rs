use crate::managers::model::{ModelManager, LLAMA_RUNTIME_MODEL_ID, LOCAL_LLM_MODEL_ID};
use log::{debug, info, warn};
use std::collections::VecDeque;
use std::fs;
use std::io::BufRead;
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Idle window before the sidecar is stopped. Deliberately independent from the
/// ASR `model_unload_timeout` (default 5 min): a cold server restart costs
/// 3-18 s, which dominates dictation latency for anyone who dictates every few
/// minutes, while the resident server costs ~1.5 GB RAM. Recording-start
/// prewarming covers dictations after an unload.
const IDLE_UNLOAD_SECS: u64 = 30 * 60;

/// How long to wait for the server to become healthy after spawn. First load
/// mmaps ~530 MB and may compile GPU pipelines on first-ever run.
const STARTUP_TIMEOUT_SECS: u64 = 90;

const SERVER_CTX_SIZE: &str = "8192";
const PID_FILE_NAME: &str = "local-llm-server.pid";

struct ServerProcess {
    child: Child,
    port: u16,
}

/// Manages the llama-server sidecar that powers the built-in local
/// post-processing model. The server is spawned lazily on first use, kept
/// resident while active, and stopped after the configured idle timeout,
/// on app exit, or when its files are deleted.
pub struct LocalLlmManager {
    app_handle: AppHandle,
    server: Arc<Mutex<Option<ServerProcess>>>,
    last_activity: Arc<AtomicU64>,
    shutdown_signal: Arc<AtomicBool>,
    /// Serializes spawn/health-check so concurrent callers (prewarm racing a
    /// dictation) never start two servers or hand out a killed server's port
    spawn_lock: Arc<tokio::sync::Mutex<()>>,
    /// Tail of the server's stderr, kept for error reporting on spawn failure
    stderr_tail: Arc<Mutex<VecDeque<String>>>,
}

impl LocalLlmManager {
    pub fn new(app_handle: &AppHandle) -> Self {
        Self::kill_orphan_from_pid_file(app_handle);

        let manager = Self {
            app_handle: app_handle.clone(),
            server: Arc::new(Mutex::new(None)),
            last_activity: Arc::new(AtomicU64::new(Self::now_ms())),
            shutdown_signal: Arc::new(AtomicBool::new(false)),
            spawn_lock: Arc::new(tokio::sync::Mutex::new(())),
            stderr_tail: Arc::new(Mutex::new(VecDeque::new())),
        };

        // Idle watcher, mirroring TranscriptionManager's pattern
        {
            let app_handle = app_handle.clone();
            let server = manager.server.clone();
            let last_activity = manager.last_activity.clone();
            let shutdown_signal = manager.shutdown_signal.clone();
            thread::spawn(move || {
                debug!("Local LLM idle watcher thread started");
                while !shutdown_signal.load(Ordering::Relaxed) {
                    thread::sleep(Duration::from_secs(10));
                    if shutdown_signal.load(Ordering::Relaxed) {
                        break;
                    }

                    let running = { server.lock().unwrap().is_some() };
                    if !running {
                        continue;
                    }

                    let idle_ms =
                        Self::now_ms().saturating_sub(last_activity.load(Ordering::Relaxed));
                    if idle_ms > IDLE_UNLOAD_SECS * 1000 {
                        info!(
                            "Local LLM server idle for {}s (limit: {}s), stopping",
                            idle_ms / 1000,
                            IDLE_UNLOAD_SECS
                        );
                        Self::stop_server(&app_handle, &server);
                    }
                }
                debug!("Local LLM idle watcher thread shutting down");
            });
        }

        manager
    }

    fn now_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
    }

    pub fn touch(&self) {
        self.last_activity.store(Self::now_ms(), Ordering::Relaxed);
    }

    /// Whether both the runtime and the model are downloaded and ready to use.
    pub fn is_available(&self) -> bool {
        let Some(model_manager) = self.app_handle.try_state::<Arc<ModelManager>>() else {
            return false;
        };
        let downloaded = |id: &str| {
            model_manager
                .get_model_info(id)
                .map(|m| m.is_downloaded)
                .unwrap_or(false)
        };
        downloaded(LOCAL_LLM_MODEL_ID) && downloaded(LLAMA_RUNTIME_MODEL_ID)
    }

    pub fn is_running(&self) -> bool {
        self.server.lock().unwrap().is_some()
    }

    /// Start the sidecar in the background if it is not running yet, so the
    /// model load overlaps with recording/transcription instead of adding
    /// cold-start seconds to the paste. Cheap no-op when already warm.
    pub fn prewarm(self: &Arc<Self>) {
        if !self.is_available() || self.is_running() {
            return;
        }
        let manager = Arc::clone(self);
        tauri::async_runtime::spawn(async move {
            match manager.ensure_ready().await {
                Ok(port) => debug!("Local LLM server prewarmed on port {}", port),
                Err(e) => debug!("Local LLM prewarm failed: {}", e),
            }
        });
    }

    /// Ensure the sidecar is running and healthy; returns its port.
    pub async fn ensure_ready(&self) -> Result<u16, String> {
        self.touch();

        // Serialize spawns: a prewarm racing a dictation must join the same
        // startup instead of spawning a second server
        let _spawn_guard = self.spawn_lock.lock().await;

        // Fast path: server already running and the process is still alive
        {
            let mut guard = self.server.lock().unwrap();
            if let Some(server) = guard.as_mut() {
                match server.child.try_wait() {
                    Ok(None) => return Ok(server.port),
                    Ok(Some(status)) => {
                        warn!("Local LLM server exited unexpectedly: {}", status);
                        *guard = None;
                    }
                    Err(e) => {
                        warn!("Failed to poll local LLM server process: {}", e);
                        *guard = None;
                    }
                }
            }
        }

        let (child, port) = self.spawn_server()?;
        {
            let mut guard = self.server.lock().unwrap();
            // A concurrent caller could have spawned meanwhile; keep ours and
            // drop theirs deterministically (post-processing is serialized by
            // the coordinator, so this is a defensive path only).
            if let Some(mut old) = guard.replace(ServerProcess { child, port }) {
                let _ = old.child.kill();
                let _ = old.child.wait();
            }
        }

        match self.wait_until_healthy(port).await {
            Ok(()) => {
                self.touch();
                info!("Local LLM server ready on 127.0.0.1:{}", port);
                Ok(port)
            }
            Err(e) => {
                Self::stop_server(&self.app_handle, &self.server);
                let tail: Vec<String> = {
                    let tail = self.stderr_tail.lock().unwrap();
                    tail.iter().cloned().collect()
                };
                Err(format!(
                    "Local LLM server failed to become ready: {}. Last output: {}",
                    e,
                    tail.join(" | ")
                ))
            }
        }
    }

    fn spawn_server(&self) -> Result<(Child, u16), String> {
        let model_manager = self
            .app_handle
            .try_state::<Arc<ModelManager>>()
            .ok_or_else(|| "Model manager not initialized".to_string())?;

        let gguf_path = model_manager
            .get_model_path(LOCAL_LLM_MODEL_ID)
            .map_err(|e| format!("Local LLM model not available: {}", e))?;
        let runtime_dir = model_manager
            .get_model_path(LLAMA_RUNTIME_MODEL_ID)
            .map_err(|e| format!("Local LLM runtime not available: {}", e))?;

        let server_bin = Self::find_server_binary(&runtime_dir)
            .ok_or_else(|| format!("llama-server binary not found in {:?}", runtime_dir))?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(meta) = fs::metadata(&server_bin) {
                let mut perms = meta.permissions();
                if perms.mode() & 0o111 == 0 {
                    perms.set_mode(0o755);
                    let _ = fs::set_permissions(&server_bin, perms);
                }
            }
        }

        let port = Self::find_free_port()?;

        info!(
            "Starting local LLM server: {:?} (model: {:?}, port: {})",
            server_bin, gguf_path, port
        );

        let mut command = Command::new(&server_bin);
        command
            .args(["-m"])
            .arg(&gguf_path)
            .args([
                "--host",
                "127.0.0.1",
                "--port",
                &port.to_string(),
                "--ctx-size",
                SERVER_CTX_SIZE,
                "-ngl",
                "99",
                // Qwen3.5 still emits thinking with --reasoning-budget 0; the
                // chat-template kwarg is the switch that actually disables it.
                "--chat-template-kwargs",
                "{\"enable_thinking\":false}",
                "--no-webui",
            ])
            .current_dir(&runtime_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped());

        #[cfg(windows)]
        command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW

        let mut child = command
            .spawn()
            .map_err(|e| format!("Failed to spawn llama-server: {}", e))?;

        // Forward stderr to the log and keep a tail for error reporting
        if let Some(stderr) = child.stderr.take() {
            let tail = self.stderr_tail.clone();
            thread::spawn(move || {
                let reader = std::io::BufReader::new(stderr);
                for line in reader.lines().map_while(Result::ok) {
                    debug!(target: "llama-server", "{}", line);
                    let mut tail = tail.lock().unwrap();
                    if tail.len() >= 20 {
                        tail.pop_front();
                    }
                    tail.push_back(line);
                }
            });
        }

        Self::write_pid_file(&self.app_handle, child.id());

        Ok((child, port))
    }

    /// The unix tarballs extract with the binary at the archive's top-level
    /// directory (renamed to the model dir), the Windows zips are flat. Check
    /// the runtime dir itself first, then one level of subdirectories.
    fn find_server_binary(runtime_dir: &Path) -> Option<PathBuf> {
        let name = if cfg!(windows) {
            "llama-server.exe"
        } else {
            "llama-server"
        };

        let direct = runtime_dir.join(name);
        if direct.exists() {
            return Some(direct);
        }

        let entries = fs::read_dir(runtime_dir).ok()?;
        for entry in entries.flatten() {
            let candidate = entry.path().join(name);
            if entry.path().is_dir() && candidate.exists() {
                return Some(candidate);
            }
        }
        None
    }

    fn find_free_port() -> Result<u16, String> {
        let listener = TcpListener::bind("127.0.0.1:0")
            .map_err(|e| format!("Failed to find a free port: {}", e))?;
        let port = listener
            .local_addr()
            .map_err(|e| format!("Failed to read local address: {}", e))?
            .port();
        drop(listener);
        Ok(port)
    }

    async fn wait_until_healthy(&self, port: u16) -> Result<(), String> {
        let url = format!("http://127.0.0.1:{}/health", port);
        let client = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(2))
            .timeout(Duration::from_secs(5))
            .build()
            .map_err(|e| format!("Failed to build health check client: {}", e))?;

        let deadline = std::time::Instant::now() + Duration::from_secs(STARTUP_TIMEOUT_SECS);
        loop {
            // Bail out early if the process died (bad binary, missing libs, ...)
            {
                let mut guard = self.server.lock().unwrap();
                if let Some(server) = guard.as_mut() {
                    if let Ok(Some(status)) = server.child.try_wait() {
                        *guard = None;
                        return Err(format!("server process exited: {}", status));
                    }
                }
            }

            if let Ok(resp) = client.get(&url).send().await {
                if resp.status().is_success() {
                    return Ok(());
                }
            }

            if std::time::Instant::now() >= deadline {
                return Err(format!(
                    "health check timed out after {}s",
                    STARTUP_TIMEOUT_SECS
                ));
            }
            tokio::time::sleep(Duration::from_millis(250)).await;
        }
    }

    /// Stop the server if it is running. Used by the idle watcher, app exit,
    /// and model deletion (Windows keeps the GGUF locked while mmap'd).
    pub fn stop(&self) {
        Self::stop_server(&self.app_handle, &self.server);
    }

    /// Signal the watcher thread to stop and kill the server. Called on app exit.
    pub fn shutdown(&self) {
        self.shutdown_signal.store(true, Ordering::Relaxed);
        self.stop();
    }

    fn stop_server(app_handle: &AppHandle, server: &Arc<Mutex<Option<ServerProcess>>>) {
        let process = { server.lock().unwrap().take() };
        if let Some(mut process) = process {
            info!("Stopping local LLM server (port {})", process.port);
            if let Err(e) = process.child.kill() {
                warn!("Failed to kill local LLM server: {}", e);
            }
            let _ = process.child.wait();
        }
        Self::remove_pid_file(app_handle);
    }

    fn pid_file_path(app_handle: &AppHandle) -> Option<PathBuf> {
        crate::portable::app_data_dir(app_handle)
            .ok()
            .map(|dir| dir.join(PID_FILE_NAME))
    }

    fn write_pid_file(app_handle: &AppHandle, pid: u32) {
        if let Some(path) = Self::pid_file_path(app_handle) {
            if let Err(e) = fs::write(&path, pid.to_string()) {
                warn!("Failed to write local LLM pid file: {}", e);
            }
        }
    }

    fn remove_pid_file(app_handle: &AppHandle) {
        if let Some(path) = Self::pid_file_path(app_handle) {
            let _ = fs::remove_file(path);
        }
    }

    /// Best-effort cleanup of a llama-server orphaned by a previous crash.
    /// Only kills the recorded pid when it still belongs to a llama-server
    /// process, so recycled pids are never harmed.
    fn kill_orphan_from_pid_file(app_handle: &AppHandle) {
        let Some(path) = Self::pid_file_path(app_handle) else {
            return;
        };
        let Ok(contents) = fs::read_to_string(&path) else {
            return;
        };
        let _ = fs::remove_file(&path);
        let Ok(pid) = contents.trim().parse::<u32>() else {
            return;
        };

        warn!(
            "Found stale local LLM pid file (pid {}), attempting cleanup",
            pid
        );

        #[cfg(unix)]
        {
            let is_llama_server = Command::new("ps")
                .args(["-p", &pid.to_string(), "-o", "comm="])
                .output()
                .map(|out| String::from_utf8_lossy(&out.stdout).contains("llama-server"))
                .unwrap_or(false);
            if is_llama_server {
                let _ = Command::new("kill").args(["-9", &pid.to_string()]).status();
                info!("Killed orphaned llama-server process {}", pid);
            }
        }

        #[cfg(windows)]
        {
            // The image-name filter makes taskkill a no-op if the pid was recycled
            let mut command = Command::new("taskkill");
            command.args([
                "/F",
                "/PID",
                &pid.to_string(),
                "/FI",
                "IMAGENAME eq llama-server.exe",
            ]);
            command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
            let _ = command.status();
        }
    }
}

impl Drop for LocalLlmManager {
    fn drop(&mut self) {
        self.shutdown();
    }
}
