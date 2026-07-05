use crate::managers::local_llm::LocalLlmManager;
use crate::managers::model::{ModelInfo, ModelManager, LLAMA_RUNTIME_MODEL_ID, LOCAL_LLM_MODEL_ID};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct LocalLlmStatus {
    /// Whether a llama-server runtime artifact exists for this platform
    pub is_supported: bool,
    /// Whether both the runtime and the model are downloaded
    pub is_available: bool,
    /// Whether the sidecar server is currently running
    pub server_running: bool,
    pub model: Option<ModelInfo>,
    pub runtime: Option<ModelInfo>,
}

#[tauri::command]
#[specta::specta]
pub async fn get_local_llm_status(
    model_manager: State<'_, Arc<ModelManager>>,
    local_llm_manager: State<'_, Arc<LocalLlmManager>>,
) -> Result<LocalLlmStatus, String> {
    let model = model_manager.get_model_info(LOCAL_LLM_MODEL_ID);
    let runtime = model_manager.get_model_info(LLAMA_RUNTIME_MODEL_ID);

    Ok(LocalLlmStatus {
        is_supported: runtime.is_some(),
        is_available: local_llm_manager.is_available(),
        server_running: local_llm_manager.is_running(),
        model,
        runtime,
    })
}

/// Download the llama-server runtime and the formatting model. The runtime is
/// fetched first (a few MB) so early failures surface before the ~500 MB model.
#[tauri::command]
#[specta::specta]
pub async fn download_local_llm(
    app_handle: AppHandle,
    model_manager: State<'_, Arc<ModelManager>>,
) -> Result<(), String> {
    for model_id in [LLAMA_RUNTIME_MODEL_ID, LOCAL_LLM_MODEL_ID] {
        let result = model_manager
            .download_model(model_id)
            .await
            .map_err(|e| e.to_string());

        if let Err(ref error) = result {
            let _ = app_handle.emit(
                "model-download-failed",
                serde_json::json!({ "model_id": model_id, "error": error }),
            );
            return result;
        }
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn cancel_local_llm_download(
    model_manager: State<'_, Arc<ModelManager>>,
) -> Result<(), String> {
    for model_id in [LLAMA_RUNTIME_MODEL_ID, LOCAL_LLM_MODEL_ID] {
        // Ignore "no active download" errors — only one of the two is
        // downloading at any moment
        let _ = model_manager.cancel_download(model_id);
    }
    Ok(())
}

/// Delete the formatting model and its runtime. Stops the server first so the
/// mmap'd GGUF is not locked (Windows cannot delete open files).
#[tauri::command]
#[specta::specta]
pub async fn delete_local_llm(
    model_manager: State<'_, Arc<ModelManager>>,
    local_llm_manager: State<'_, Arc<LocalLlmManager>>,
) -> Result<(), String> {
    local_llm_manager.stop();

    let mut last_error: Option<String> = None;
    for model_id in [LOCAL_LLM_MODEL_ID, LLAMA_RUNTIME_MODEL_ID] {
        let has_files = model_manager
            .get_model_info(model_id)
            .map(|m| m.is_downloaded || m.partial_size > 0)
            .unwrap_or(false);
        if !has_files {
            continue;
        }
        if let Err(e) = model_manager.delete_model(model_id) {
            last_error = Some(e.to_string());
        }
    }

    match last_error {
        Some(e) => Err(e),
        None => Ok(()),
    }
}
