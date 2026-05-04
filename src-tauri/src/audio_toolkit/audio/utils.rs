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
pub fn decode_audio_to_mono_f32<P: AsRef<Path>>(file_path: P) -> Result<(Vec<f32>, u32)> {
    use symphonia::core::errors::Error as SErr;

    let file = std::fs::File::open(file_path.as_ref())
        .map_err(|e| anyhow::anyhow!("Cannot open file: {}", e))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = file_path.as_ref().extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|e| anyhow::anyhow!("Unsupported audio format: {}", e))?;

    let mut format = probed.format;

    let track = format
        .default_track()
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
