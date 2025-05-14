"use client";
import React, { useRef, useState, useEffect } from "react";

const AudioRecorder = () => {
  const MAX_DURATION = 20; // 20 seconds

  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaStreamSourceRef = useRef(null);
  const processorRef = useRef(null);
  const audioDataRef = useRef([]);

  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const [timeLeft, setTimeLeft] = useState(MAX_DURATION);
  const [timerId, setTimerId] = useState(null);

  const initAudioContext = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(stream);

      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      audioDataRef.current = [];

      processorRef.current.onaudioprocess = (e) => {
        if (!paused) {
          const channelData = e.inputBuffer.getChannelData(0);
          audioDataRef.current.push(new Float32Array(channelData));
        }
      };

      mediaStreamSourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Microphone access is required.");
    }
  };

  const startRecording = async () => {
    await initAudioContext();
    setRecording(true);
    setPaused(false);
    setTimeLeft(MAX_DURATION);

    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setTimerId(id);
  };

  const pauseRecording = () => {
    setPaused((prev) => !prev);
  };

  const stopRecording = () => {
  clearInterval(timerId);

  if (processorRef.current) processorRef.current.disconnect();
  if (mediaStreamSourceRef.current) mediaStreamSourceRef.current.disconnect();

  const merged = mergeBuffers(audioDataRef.current);
  const sampleRate = audioContextRef.current?.sampleRate || 44100; // fallback just in case
  const wavBlob = encodeWAV(merged, sampleRate);
  const url = URL.createObjectURL(wavBlob);

  setAudioURL(url);
  setRecording(false);
  setPaused(false);
  setTimeLeft(MAX_DURATION);

  cleanup();

  console.log("WAV Blob ready for S3 upload:", wavBlob);
};


  const reRecord = () => {
    setAudioURL(null);
    setRecording(false);
    setPaused(false);
    setTimeLeft(MAX_DURATION);
  };

  const cleanup = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const mergeBuffers = (buffers) => {
    const length = buffers.reduce((acc, b) => acc + b.length, 0);
    const result = new Float32Array(length);
    let offset = 0;
    for (const buffer of buffers) {
      result.set(buffer, offset);
      offset += buffer.length;
    }
    return result;
  };

  const encodeWAV = (samples, sampleRate) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    function writeString(view, offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // Subchunk1Size (PCM)
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, 1, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    writeString(view, 36, "data");
    view.setUint32(40, samples.length * 2, true); // Subchunk2Size

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: "audio/wav" });
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      {!recording && !audioURL && (
        <button onClick={startRecording}>Start Recording</button>
      )}

      {recording && (
        <>
          <p>Recording... {timeLeft}s left</p>
          <button onClick={pauseRecording}>{paused ? "Resume" : "Pause"}</button>
          <button onClick={stopRecording}>Stop</button>
        </>
      )}

      {audioURL && (
        <div>
          <p>Recorded Audio:</p>
          <audio controls src={audioURL}></audio>
          <br />
          <button onClick={reRecord}>Re-record</button>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
