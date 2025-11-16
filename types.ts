/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
export interface RagStore {
    name: string;
    displayName: string;
}

export interface CustomMetadata {
  key?: string;
  stringValue?: string;
  stringListValue?: string[];
  numericValue?: number;
}

export interface Document {
    name: string;
    displayName: string;
    customMetadata?: CustomMetadata[];
}

export interface GroundingChunk {
    retrievedContext?: {
        text?: string;
    };
    document?: {
        name?: string;
        displayName?: string;
    };
    chunk?: {
        text?: string;
    };
}

export interface GroundingSupport {
    confidenceScore?: number;
    segment?: {
        startIndex?: number;
        endIndex?: number;
    };
}

export interface QueryResult {
    text: string;
    groundingChunks?: GroundingChunk[];
    groundingSupport?: GroundingSupport[];
    fullMetadata?: any;
}

export enum AppStatus {
    Initializing,
    Welcome,
    PreparingChat,
    Chatting,
    Error,
}

export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
    groundingChunks?: GroundingChunk[];
}