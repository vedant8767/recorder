"use client"
import React, { useRef, useState } from "react";

const AudioRecorder = () => {
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaStreamSourceRef = useRef(null);
  const processorRef = useRef(null);
  const audioDataRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);

const initAudioContext = async () => {
  try {
    const stream = await window.navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;

    audioContextRef.current = new window.AudioContext();
    mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(stream);

    processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
    audioDataRef.current = [];

    processorRef.current.onaudioprocess = (e) => {
      const channelData = e.inputBuffer.getChannelData(0);
      audioDataRef.current.push(new Float32Array(channelData));
    };

    mediaStreamSourceRef.current.connect(processorRef.current);
    processorRef.current.connect(audioContextRef.current.destination);

  } catch (err) {
    console.error("Microphone permission denied or not available:", err);
    alert("Microphone access is required to start recording. Please allow mic permissions.");
  }
};
;

  const startRecording = async () => {
    if (!audioContextRef.current) {
      await initAudioContext();
    }
    setRecording(true);
  };

  const stopRecording = () => {
    processorRef.current.disconnect();
    mediaStreamSourceRef.current.disconnect();

    const merged = mergeBuffers(audioDataRef.current);
    const wavBlob = encodeWAV(merged, audioContextRef.current.sampleRate);
    const url = URL.createObjectURL(wavBlob);
    setAudioURL(url);

    setRecording(false);
    cleanup();
  };

  const cleanup = () => {
    mediaStreamRef.current.getTracks().forEach(track => track.stop());
    audioContextRef.current.close();
    audioContextRef.current = null;
  };

  const mergeBuffers = (buffers) => {
    const length = buffers.reduce((acc, val) => acc + val.length, 0);
    const result = new Float32Array(length);
    let offset = 0;
    buffers.forEach(buffer => {
      result.set(buffer, offset);
      offset += buffer.length;
    });
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
    view.setUint32(16, 16, true); // subchunk1 size
    view.setUint16(20, 1, true); // audio format (1 = PCM)
    view.setUint16(22, 1, true); // num channels
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(view, 36, "data");
    view.setUint32(40, samples.length * 2, true);

    // PCM conversion
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: "audio/wav" });
  };

  return (
    <div>
      <button onClick={startRecording} disabled={recording}>
        Start Recording
      </button>
      <button onClick={stopRecording} disabled={!recording}>
        Stop Recording
      </button>
      {audioURL && (
        <div>
          <audio controls src={audioURL}></audio>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;

