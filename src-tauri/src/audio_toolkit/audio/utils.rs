use anyhow::Result;
use hound::{WavReader, WavSpec, WavWriter};
use log::debug;
use rubato::{FftFixedIn, Resampler};
use std::path::Path;
use symphonia::core::{
    audio::SampleBuffer,
    codecs::DecoderOptions,
    formats::FormatOptions,
    io::MediaSourceStream,
    meta::MetadataOptions,
    probe::Hint,
};

/// Read a WAV file and return normalised f32 samples.
pub fn read_wav_samples<P: AsRef<Path>>(file_path: P) -> Result<Vec<f32>> {
    let reader = WavReader::open(file_path.as_ref())?;
    let samples = reader
        .into_samples::<i16>()
        .map(|s| s.map(|v| v as f32 / i16::MAX as f32))
        .collect::<Result<Vec<f32>, _>>()?;
    Ok(samples)
}

/// Verify a WAV file by reading it back and checking the sample count.
pub fn verify_wav_file<P: AsRef<Path>>(file_path: P, expected_samples: usize) -> Result<()> {
    let reader = WavReader::open(file_path.as_ref())?;
    let actual_samples = reader.len() as usize;
    if actual_samples != expected_samples {
        anyhow::bail!(
            "WAV sample count mismatch: expected {}, got {}",
            expected_samples,
            actual_samples
        );
    }
    Ok(())
}

/// Save audio samples as a WAV file
pub fn save_wav_file<P: AsRef<Path>>(file_path: P, samples: &[f32]) -> Result<()> {
    let spec = WavSpec {
        channels: 1,
        sample_rate: 16000,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut writer = WavWriter::create(file_path.as_ref(), spec)?;

    // Convert f32 samples to i16 for WAV
    for sample in samples {
        let sample_i16 = (sample * i16::MAX as f32) as i16;
        writer.write_sample(sample_i16)?;
    }

    writer.finalize()?;
    debug!("Saved WAV file: {:?}", file_path.as_ref());
    Ok(())
}

/// Decode any supported audio file (MP3, WAV, M4A, FLAC, OGG, …) to mono f32 samples.
/// Returns (samples, original_sample_rate).
/// Falls back to ffmpeg when Symphonia cannot handle the file (e.g. some MP4 variants).
pub fn decode_audio_to_mono_f32<P: AsRef<Path>>(file_path: P) -> Result<(Vec<f32>, u32)> {
    match decode_via_symphonia(file_path.as_ref()) {
        Ok(result) => Ok(result),
        Err(symphonia_err) => {
            log::debug!(
                "Symphonia failed ({}), trying ffmpeg fallback",
                symphonia_err
            );
            decode_via_ffmpeg(file_path.as_ref()).map_err(|ffmpeg_err| {
                anyhow::anyhow!(
                    "Audio decode failed: {} (ffmpeg fallback also failed: {})",
                    symphonia_err,
                    ffmpeg_err
                )
            })
        }
    }
}

/// Fallback decoder using platform-native or external tools.
/// macOS: uses `afconvert` (always available). Other platforms: tries `ffmpeg`.
fn decode_via_ffmpeg(file_path: &Path) -> Result<(Vec<f32>, u32)> {
    let path_str = file_path
        .to_str()
        .ok_or_else(|| anyhow::anyhow!("Invalid file path"))?;

    #[cfg(target_os = "macos")]
    {
        // afconvert is built into every macOS install — no external dependency needed.
        let tmp = std::env::temp_dir().join(format!(
            "momentum_decode_{}.wav",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        let status = std::process::Command::new("afconvert")
            .args([
                "-f", "WAVE",
                "-d", "LEI16@16000",  // 16-bit LE PCM at 16 kHz
                "-c", "1",            // mono
                path_str,
                tmp.to_str().unwrap(),
            ])
            .status()
            .map_err(|e| anyhow::anyhow!("afconvert failed to launch: {}", e))?;

        if !status.success() {
            return Err(anyhow::anyhow!("afconvert exited with status {}", status));
        }

        let result = read_wav_samples(&tmp)
            .map(|samples| (samples, 16000u32))
            .map_err(|e| anyhow::anyhow!("Failed to read afconvert output: {}", e));
        let _ = std::fs::remove_file(&tmp);
        return result;
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Look for a bundled ffmpeg: first in resources/ subdir (Tauri NSIS layout),
        // then next to the exe (portable/dev), then fall back to PATH.
        let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.to_path_buf()));
        let bin_name = if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" };
        let bundled = exe_dir.as_ref().and_then(|d| {
            let in_resources = d.join("resources").join(bin_name);
            let next_to_exe = d.join(bin_name);
            if in_resources.exists() { Some(in_resources) }
            else if next_to_exe.exists() { Some(next_to_exe) }
            else { None }
        });

        let ffmpeg_bin = bundled
            .as_ref()
            .and_then(|p| p.to_str())
            .unwrap_or("ffmpeg");

        let output = std::process::Command::new(ffmpeg_bin)
            .args([
                "-i", path_str,
                "-vn",
                "-ac", "1",
                "-ar", "16000",
                "-f", "s16le",
                "-",
            ])
            .output()
            .map_err(|e| anyhow::anyhow!(
                "ffmpeg not found. Install ffmpeg or place ffmpeg.exe next to the app. ({})",
                e
            ))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("ffmpeg error: {}", stderr.trim()));
        }

        let samples: Vec<f32> = output.stdout
            .chunks_exact(2)
            .map(|b| i16::from_le_bytes([b[0], b[1]]) as f32 / i16::MAX as f32)
            .collect();

        Ok((samples, 16000))
    }
}

fn decode_via_symphonia(file_path: &Path) -> Result<(Vec<f32>, u32)> {
    use symphonia::core::errors::Error as SErr;

    let file = std::fs::File::open(file_path)
        .map_err(|e| anyhow::anyhow!("Cannot open file: {}", e))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = file_path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|e| anyhow::anyhow!("Unsupported audio format: {}", e))?;

    let mut format = probed.format;

    // Find the first track with a sample rate — skips video tracks in MP4/WebM containers.
    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.sample_rate.is_some())
        .or_else(|| format.default_track())
        .ok_or_else(|| anyhow::anyhow!("No audio track found in file"))?;

    let track_id = track.id;
    let sample_rate = track
        .codec_params
        .sample_rate
        .ok_or_else(|| anyhow::anyhow!("Unknown sample rate"))?;
    let channels = track
        .codec_params
        .channels
        .map(|c| c.count())
        .unwrap_or(1);

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| anyhow::anyhow!("Failed to create audio decoder: {}", e))?;

    let mut samples: Vec<f32> = Vec::new();

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(SErr::IoError(e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(SErr::ResetRequired) => {
                decoder.reset();
                continue;
            }
            Err(e) => return Err(anyhow::anyhow!("Read error: {}", e)),
        };

        if packet.track_id() != track_id {
            continue;
        }

        match decoder.decode(&packet) {
            Ok(decoded) => {
                let spec = *decoded.spec();
                let mut buf = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
                buf.copy_interleaved_ref(decoded);
                let pcm = buf.samples();

                if channels == 1 {
                    samples.extend_from_slice(pcm);
                } else {
                    for chunk in pcm.chunks(channels) {
                        let mono = chunk.iter().sum::<f32>() / channels as f32;
                        samples.push(mono);
                    }
                }
            }
            Err(SErr::DecodeError(_)) => continue,
            Err(e) => return Err(anyhow::anyhow!("Decode error: {}", e)),
        }
    }

    Ok((samples, sample_rate))
}

/// Resample mono f32 samples to 16 000 Hz (the rate Whisper expects).
pub fn resample_to_16k(samples: Vec<f32>, src_rate: u32) -> Result<Vec<f32>> {
    if src_rate == 16000 {
        return Ok(samples);
    }

    const CHUNK: usize = 8192;
    let mut resampler = FftFixedIn::<f32>::new(src_rate as usize, 16000, CHUNK, 2, 1)
        .map_err(|e| anyhow::anyhow!("Failed to create resampler: {}", e))?;

    let mut output: Vec<f32> = Vec::with_capacity(
        (samples.len() as f64 * 16000.0 / src_rate as f64).ceil() as usize + CHUNK,
    );

    let mut pos = 0usize;
    while pos + CHUNK <= samples.len() {
        let out = resampler
            .process(&[&samples[pos..pos + CHUNK]], None)
            .map_err(|e| anyhow::anyhow!("Resample error: {}", e))?;
        output.extend_from_slice(&out[0]);
        pos += CHUNK;
    }

    if pos < samples.len() {
        let remaining = samples.len() - pos;
        let mut padded = vec![0.0f32; CHUNK];
        padded[..remaining].copy_from_slice(&samples[pos..]);
        let out = resampler
            .process(&[&padded], None)
            .map_err(|e| anyhow::anyhow!("Resample error (tail): {}", e))?;
        let expected = ((remaining as f64 * 16000.0 / src_rate as f64).ceil() as usize)
            .min(out[0].len());
        output.extend_from_slice(&out[0][..expected]);
    }

    Ok(output)
}
