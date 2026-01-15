
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

export const callGeminiStream = async (
  prompt: string, 
  history: any[] = [], 
  knowledgeFiles: any[] = [],
  isPro: boolean = false,
  onChunk: (text: string, thinking?: string) => void
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  const contents = history.map(h => ({
    role: h.role,
    parts: [
      ...(h.files ? h.files.map((f: any) => ({ inlineData: { mimeType: f.mimeType, data: f.data } })) : []),
      { text: h.text }
    ]
  }));

  const parts: any[] = [];

  // Ngữ cảnh tri thức bổ sung
  if (knowledgeFiles && knowledgeFiles.length > 0) {
    let contextText = "NGỮ CẢNH TRI THỨC BỔ SUNG (ƯU TIÊN): \n";
    knowledgeFiles.forEach(f => {
      contextText += `- Tệp: ${f.name}\n`;
    });
    contextText += "\nSử dụng nội dung từ các tệp đính kèm bên dưới làm căn cứ nghiệp vụ chính cho câu trả lời.\n";
    parts.push({ text: contextText });
    
    for (const file of knowledgeFiles) {
      parts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data
        }
      });
    }
  }

  parts.push({ text: `Yêu cầu nghiệp vụ: ${prompt}` });
  
  contents.push({
    role: 'user',
    parts: parts
  });

  try {
    const modelName = isPro ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    const config: any = {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: isPro ? 0.7 : 0.1,
    };

    if (isPro) {
      config.thinkingConfig = { thinkingBudget: 32768 };
    } else {
      config.thinkingConfig = { thinkingBudget: 0 };
    }

    const result = await ai.models.generateContentStream({
      model: modelName,
      contents: contents,
      config: config
    });

    let fullText = "";
    let fullThinking = "";

    for await (const chunk of result) {
      if (chunk.text) {
        fullText += chunk.text;
      }
      // Assuming thinking might come in parts if supported by SDK in future, 
      // but for now we follow the response structure.
      onChunk(fullText, fullThinking);
    }
    return fullText;
  } catch (error) {
    console.error("Gemini Stream Error:", error);
    throw error;
  }
};

export const generateTTS = async (text: string): Promise<string | undefined> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Đọc văn bản sau bằng giọng chuyên nghiệp, mạch lạc: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("TTS Error:", error);
    return undefined;
  }
};

// Simple base64 decoders for audio
export function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function encodeAudio(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
