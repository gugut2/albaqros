import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { DetachedNoteWindow } from './components/DetachedNoteWindow';
import './styles/index.css';

const searchParams = new URLSearchParams(window.location.search);
const hashParams = new URLSearchParams(window.location.hash.replace(/^#\/?/, ''));
const isDetachedNote = searchParams.get('mode') === 'detached-note' || hashParams.get('mode') === 'detached-note';
const detachedNotePath = searchParams.get('notePath') || hashParams.get('notePath');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isDetachedNote && detachedNotePath ? (
      <DetachedNoteWindow notePath={detachedNotePath} />
    ) : (
      <App />
    )}
  </React.StrictMode>
);
