/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef } from 'react';
import { RagStore, Document } from '../types';
import Spinner from './Spinner';
import UploadIcon from './icons/UploadIcon';
import TrashIcon from './icons/TrashIcon';

interface DocumentListProps {
    selectedStore: RagStore | null;
    documents: Document[];
    isLoading: boolean;
    onUpload: (files: File[]) => void;
    onDelete: (docName: string) => void;
}

const DocumentList: React.FC<DocumentListProps> = ({ selectedStore, documents, isLoading, onUpload, onDelete }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            onUpload(Array.from(files));
        }
        // Reset file input to allow uploading the same file again
        event.target.value = '';
    };

    if (!selectedStore) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-center text-gem-offwhite/60">
                <p className="text-lg">Select a RAG Store</p>
                <p>to view and manage its documents.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                multiple
            />
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold truncate" title={selectedStore.displayName}>Documents</h2>
                <button
                    onClick={handleUploadClick}
                    className="p-2 bg-gem-red hover:bg-red-600 rounded-full text-white transition-colors disabled:bg-gem-mist disabled:cursor-not-allowed"
                    disabled={isLoading}
                    aria-label="Upload document"
                    title="Upload a new document to this store"
                >
                    <UploadIcon />
                </button>
            </div>
            
            {isLoading && !documents.length ? (
                <div className="flex-grow flex items-center justify-center">
                    <Spinner />
                </div>
            ) : documents.length === 0 && !isLoading ? (
                <div className="flex-grow flex items-center justify-center text-center text-gem-offwhite/60">
                    <p>No documents found. <br /> Click the upload icon to add one.</p>
                </div>
            ) : (
                <ul className="space-y-2 overflow-y-auto">
                    {isLoading && (
                        <div className="absolute inset-0 bg-gem-slate/50 flex items-center justify-center z-10">
                            <Spinner />
                        </div>
                    )}
                    {documents.map((doc) => (
                        <li key={doc.name} className="p-3 bg-gem-mist rounded-md group">
                             <div className="flex items-center justify-between">
                                <span className="truncate font-medium" title={doc.displayName}>{doc.displayName}</span>
                                <button 
                                    onClick={() => onDelete(doc.name)}
                                    className="ml-2 p-1 text-red-400 hover:text-red-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label={`Delete ${doc.displayName}`}
                                    title={`Delete ${doc.displayName}`}
                                    disabled={isLoading}
                                >
                                <TrashIcon />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default DocumentList;