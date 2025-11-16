/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback } from 'react';
import { AppStatus, RagStore, Document } from '../types';
import * as geminiService from '../services/geminiService';
import Spinner from '../components/Spinner';
import RagStoreList from '../components/RagStoreList';
import DocumentList from '../components/DocumentList';

const AdminApp: React.FC = () => {
    const [status, setStatus] = useState<AppStatus>(AppStatus.Initializing);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    const [stores, setStores] = useState<RagStore[]>([]);
    const [selectedStore, setSelectedStore] = useState<RagStore | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isDocsLoading, setIsDocsLoading] = useState(false);

    const isApiKeySelected = !!import.meta.env.VITE_GEMINI_API_KEY;

    const handleError = (message: string, err: any) => {
        console.error(message, err);
        const errorMessage = `${message}${err ? `: ${err instanceof Error ? err.message : String(err)}` : ''}`;
        setError(errorMessage);
        setIsLoading(false);
        setIsDocsLoading(false);
    };

    const clearError = () => {
        setError(null);
    };

    const initializeAndFetch = useCallback(async () => {
        if (!isApiKeySelected) return;
        setIsLoading(true);
        setError(null);
        try {
            geminiService.initialize();
            await fetchStores();
        } catch (err) {
            handleError("Initialization failed", err);
        } finally {
            setIsLoading(false);
        }
    }, [isApiKeySelected]);

    useEffect(() => {
        if(isApiKeySelected) {
            initializeAndFetch();
        } else {
            setStatus(AppStatus.Welcome);
        }
    }, [isApiKeySelected, initializeAndFetch]);

    const fetchStores = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const fetchedStores = await geminiService.listRagStores();
            setStores(fetchedStores);
            setStatus(AppStatus.Chatting); // Using Chatting status for the main view
            if (selectedStore && !fetchedStores.find(s => s.name === selectedStore.name)) {
                setSelectedStore(null);
                setDocuments([]);
            }
        } catch (err) {
            handleError("Failed to fetch RAG stores", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateStore = async (displayName: string) => {
        setIsLoading(true);
        try {
            await geminiService.createRagStore(displayName);
            await fetchStores();
        } catch (err) {
            handleError(`Failed to create store "${displayName}"`, err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteStore = async (storeName: string) => {
        if (!window.confirm("Are you sure you want to delete this store and all its documents? This action cannot be undone.")) {
            return;
        }
        setIsLoading(true);
        try {
            await geminiService.deleteRagStore(storeName);
            await fetchStores();
        } catch (err) {
            handleError("Failed to delete store", err);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSelectStore = async (store: RagStore) => {
        if (selectedStore?.name === store.name) return;
        setSelectedStore(store);
        setIsDocsLoading(true);
        setDocuments([]);
        try {
            const fetchedDocs = await geminiService.listDocuments(store.name);
            setDocuments(fetchedDocs);
        } catch (err) {
            handleError(`Failed to fetch documents for ${store.displayName}`, err);
            setSelectedStore(null);
        } finally {
            setIsDocsLoading(false);
        }
    };
    
    const handleUploadDocuments = async (files: File[]) => {
        if (!selectedStore) return;
        setIsDocsLoading(true);
        try {
            await geminiService.uploadFilesToRagStore(selectedStore.name, files);
            const fetchedDocs = await geminiService.listDocuments(selectedStore.name);
            setDocuments(fetchedDocs);
        } catch (err) {
            handleError(`Failed to upload files`, err);
        } finally {
            setIsDocsLoading(false);
        }
    };
    
    const handleDeleteDocument = async (docName: string) => {
         if (!window.confirm("Are you sure you want to delete this document?")) {
            return;
        }
        if (!selectedStore) return;
        setIsDocsLoading(true);
        try {
            await geminiService.deleteDocument(docName);
            const fetchedDocs = await geminiService.listDocuments(selectedStore.name);
            setDocuments(fetchedDocs);
        } catch (err) {
            handleError("Failed to delete document", err);
        } finally {
            setIsDocsLoading(false);
        }
    };

    const renderContent = () => {
        if (status === AppStatus.Initializing || (isApiKeySelected && isLoading && stores.length === 0)) {
            return (
                <div className="flex items-center justify-center h-screen">
                    <Spinner /> <span className="ml-4 text-xl">Initializing...</span>
                </div>
            );
        }

        if (!isApiKeySelected) {
            return (
                 <div className="flex flex-col items-center justify-center h-screen text-center">
                    <h1 className="text-3xl font-bold mb-4">RAG Store Management</h1>
                    <p className="max-w-md text-gem-offwhite/70 mb-8">Please set your Gemini API Key in the .env.local file to create, view, and manage your RAG stores and documents.</p>
                     <div className="w-full max-w-xl mx-auto mb-8">
                        <div className="w-full bg-gem-slate border border-gem-mist/50 rounded-lg py-3 px-5 text-center text-red-500 font-semibold">
                            Please set your Gemini API Key in the .env.local file.
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="h-screen flex flex-col p-4 gap-4">
                <header>
                    <h1 className="text-3xl font-bold text-center">RAG Store Management</h1>
                    <p className="text-center text-gem-offwhite/60">Create a store named `valorant-coach-shared-store` and upload documents for the main app.</p>
                </header>
                {error && (
                     <div className="bg-red-900/50 text-red-300 p-3 rounded-md flex justify-between items-center">
                        <p>{error}</p>
                        <button onClick={clearError} className="font-bold text-xl px-2">&times;</button>
                    </div>
                )}
                <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden">
                    <section className="bg-gem-slate p-4 rounded-lg overflow-hidden flex flex-col">
                        <RagStoreList 
                            stores={stores}
                            selectedStore={selectedStore}
                            isLoading={isLoading}
                            onCreate={handleCreateStore}
                            onSelect={handleSelectStore}
                            onDelete={handleDeleteStore}
                            onRefresh={fetchStores}
                        />
                    </section>
                    <section className="bg-gem-slate p-4 rounded-lg overflow-hidden flex flex-col">
                        <DocumentList
                            selectedStore={selectedStore}
                            documents={documents}
                            isLoading={isDocsLoading}
                            onUpload={handleUploadDocuments}
                            onDelete={handleDeleteDocument}
                        />
                    </section>
                </div>
            </div>
        );
    };

    return (
        <main className="h-screen bg-gem-onyx text-gem-offwhite">
            {renderContent()}
        </main>
    );
};

export default AdminApp;
