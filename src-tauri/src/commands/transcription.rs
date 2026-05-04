use crate::audio_toolkit::{decode_audio_to_mono_f32, resample_to_16k};
use crate::managers::transcription::TranscriptionManager;
use crate::settings::{get_settings, write_settings, ModelUnloadTimeout};
use serde::Serialize;
use specta::Type;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize, Type)]
pub struct ModelLoadStatus {
    is_loaded: bool,
    current_model: Option<String>,
}

/// Shared cancel flag for the currently running file transcription.
pub struct FileTranscriptionCancel(pub Arc<AtomicBool>);

#[derive(Clone, Serialize)]
struct FileTranscriptionProgress {
    progress: f32,
    partial_text: String,
    /// "decoding" | "loading_model" | "transcribing"
    stage: String,
}

#[tauri::command]
#[specta::specta]
pub fn set_model_unload_timeout(app: AppHandle, timeout: ModelUnloadTimeout) {
    let mut settings = get_settings(&app);
    settings.model_unload_timeout = timeout;
    write_settings(&app, settings);
}

#[tauri::command]
#[specta::specta]
pub fn get_model_load_status(
    transcription_manager: State<TranscriptionManager>,
) -> Result<ModelLoadStatus, String> {
    Ok(ModelLoadStatus {
        is_loaded: transcription_manager.is_model_loaded(),
        current_model: transcription_manager.get_current_model(),
    })
}

#[tauri::command]
#[specta::specta]
pub fn unload_model_manually(
    transcription_manager: State<TranscriptionManager>,
) -> Result<(), String> {
    transcription_manager
        .unload_model()
        .map_err(|e| format!("Failed to unload model: {}", e))
}

/// Cancel a running file transcription.
#[tauri::command]
#[specta::specta]
pub fn cancel_file_transcription(cancel: State<'_, FileTranscriptionCancel>) {
    cancel.0.store(true, Ordering::Relaxed);
}

/// Decode an audio file and transcribe it in 30-second chunks, emitting
/// `file-transcription-progress` events as each chunk completes.
/// Supports MP3, WAV, M4A, FLAC, OGG via Symphonia; auto-resamples to 16 kHz.
#[tauri::command]
#[specta::specta]
pub async fn transcribe_file(
    path: String,
    app: AppHandle,
    transcription_manager: State<'_, Arc<TranscriptionManager>>,
    cancel: State<'_, FileTranscriptionCancel>,
) -> Result<String, String> {
    let tm = transcription_manager.inner().clone();
    let cancel_flag = cancel.0.clone();

    // Reset any previous cancel
    cancel_flag.store(false, Ordering::Relaxed);

    // Kick off model loading in parallel with decoding
    tm.initiate_model_load();

    // Tell the UI we're starting — decoding can take a while on long files
    let _ = app.emit(
        "file-transcription-progress",
        FileTranscriptionProgress {
            progress: 0.0,
            partial_text: String::new(),
            stage: "decoding".to_string(),
        },
    );

    // Decode + resample in a blocking thread
    let path_clone = path.clone();
    let audio = tokio::task::spawn_blocking(move || -> Result<Vec<f32>, String> {
        let (raw, rate) = decode_audio_to_mono_f32(&path_clone)
            .map_err(|e| format!("Audio decode failed: {}", e))?;
        resample_to_16k(raw, rate).map_err(|e| format!("Resample failed: {}", e))
    })
    .await
    .map_err(|e| format!("Thread error: {}", e))?
    .map_err(|e| e)?;

    // If the model isn't loaded yet, surface that — first-time loads can take 10s+
    if !tm.is_model_loaded() {
        let _ = app.emit(
            "file-transcription-progress",
            FileTranscriptionProgress {
                progress: 0.0,
                partial_text: String::new(),
                stage: "loading_model".to_string(),
            },
        );
    }

    // Split into 30-second chunks with a 1-second overlap to avoid cutting mid-word.
    // Chunking also fixes models like Parakeet that can't handle very long audio in one shot.
    const CHUNK: usize = 30 * 16000;
    const OVERLAP: usize = 1 * 16000;

    let mut chunks: Vec<Vec<f32>> = Vec::new();
    let mut pos = 0usize;
    while pos < audio.len() {
        let end = (pos + CHUNK).min(audio.len());
        chunks.push(audio[pos..end].to_vec());
        if end == audio.len() {
            break;
        }
        pos += CHUNK - OVERLAP;
    }

    let total = chunks.len();
    let mut full_text = String::new();

    for (i, chunk) in chunks.into_iter().enumerate() {
        if cancel_flag.load(Ordering::Relaxed) {
            return Err("Cancelled".to_string());
        }

        let tm_clone = tm.clone();
        let chunk_text = tokio::task::spawn_blocking(move || {
            tm_clone.transcribe(chunk).map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| format!("Thread error: {}", e))?
        .map_err(|e| e)?;

        if !chunk_text.is_empty() {
            if !full_text.is_empty() {
                full_text.push(' ');
            }
            full_text.push_str(chunk_text.trim());
        }

        let progress = (i + 1) as f32 / total as f32 * 100.0;
        let _ = app.emit(
            "file-transcription-progress",
            FileTranscriptionProgress {
                progress,
                partial_text: full_text.clone(),
                stage: "transcribing".to_string(),
            },
        );
    }

    Ok(full_text)
}
