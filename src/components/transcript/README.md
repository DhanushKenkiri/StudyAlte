# Interactive Transcript Navigation

A comprehensive React component system for displaying and interacting with video transcripts, featuring real-time synchronization, search capabilities, note-taking, and bookmarking functionality.

## Features

### 🎯 Core Functionality
- **Real-time Video Synchronization**: Automatically highlights current segment based on video playback time
- **Clickable Segments**: Jump to any part of the video by clicking on transcript segments
- **Auto-scroll**: Automatically scrolls to keep the current segment in view
- **Multi-format Export**: Export transcripts in TXT, SRT, VTT, or JSON formats

### 🔍 Search & Navigation
- **Full-text Search**: Search across all transcript content with highlighting
- **Search Navigation**: Navigate between search results with previous/next controls
- **Keyboard Shortcuts**: Efficient navigation using keyboard controls
- **Context Menu**: Right-click segments for quick actions

### 📝 Note-taking System
- **Segment Notes**: Add notes to specific transcript segments
- **Rich Note Editor**: Full-featured editor with tags and privacy settings
- **Note Management**: Create, edit, and delete notes with timestamps
- **Notes Panel**: Dedicated sidebar for viewing and managing all notes

### 🔖 Bookmarking
- **Quick Bookmarks**: Mark important segments for easy reference
- **Visual Indicators**: Clear visual markers for bookmarked segments
- **Bookmark Management**: Toggle bookmarks on/off with context menu

### ⚙️ Customization
- **Settings Panel**: Configure display preferences and behavior
- **Theme Support**: Full Material-UI theme integration
- **Responsive Design**: Works seamlessly across desktop and mobile devices
- **Accessibility**: WCAG compliant with proper ARIA labels and keyboard navigation

## Components

### InteractiveTranscriptNavigation
The main component that orchestrates all transcript functionality.

```tsx
import { InteractiveTranscriptNavigation } from './components/transcript';

<InteractiveTranscriptNavigation
  transcript={transcriptData}
  videoUrl="https://youtube.com/watch?v=..."
  currentTime={currentTime}
  isPlaying={isPlaying}
  onTimeSeek={handleTimeSeek}
  onPlay={handlePlay}
  onPause={handlePause}
  notes={notes}
  onNoteCreate={handleNoteCreate}
  onNoteUpdate={handleNoteUpdate}
  onNoteDelete={handleNoteDelete}
  bookmarks={bookmarks}
  onBookmarkToggle={handleBookmarkToggle}
  showVideoPlayer={true}
  allowNotes={true}
  allowBookmarks={true}
  allowExport={true}
/>
```

### TranscriptViewer
Core transcript display component with basic playback controls.

```tsx
import { TranscriptViewer } from './components/transcript';

<TranscriptViewer
  transcript={transcriptData}
  currentTime={currentTime}
  onSeekTo={handleSeek}
  showTimestamps={true}
  allowSearch={true}
  allowExport={true}
/>
```

### VideoPlayer
Integrated video player with transcript synchronization.

```tsx
import { VideoPlayer } from './components/transcript';

<VideoPlayer
  videoUrl="https://youtube.com/watch?v=..."
  currentTime={currentTime}
  onTimeUpdate={handleTimeUpdate}
  segments={transcriptSegments}
  autoPlay={false}
  showControls={true}
/>
```

### NoteEditor
Rich note editing interface with tags and privacy controls.

```tsx
import { NoteEditor } from './components/transcript';

<NoteEditor
  segmentId="segment-123"
  segmentText="The transcript text for this segment"
  onSubmit={handleNoteSubmit}
  onCancel={handleCancel}
  initialContent=""
  initialTags={[]}
  initialIsPrivate={false}
/>
```

## Data Types

### TranscriptData
```typescript
interface TranscriptData {
  videoId: string;
  language: string;
  duration: number;
  confidence: number;
  source: 'youtube' | 'upload' | 'generated';
  fullText: string;
  segments: TranscriptSegment[];
}
```

### TranscriptSegment
```typescript
interface TranscriptSegment {
  id?: string;
  text: string;
  start: number;
  end: number;
  confidence?: number;
  speaker?: string;
}
```

### TranscriptNote
```typescript
interface TranscriptNote {
  id: string;
  segmentId: string;
  content: string;
  timestamp: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  isPrivate: boolean;
}
```

## Usage Examples

### Basic Implementation
```tsx
import React, { useState } from 'react';
import { InteractiveTranscriptNavigation } from './components/transcript';

const MyVideoPage = () => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [notes, setNotes] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);

  const handleTimeSeek = (time: number) => {
    setCurrentTime(time);
    // Update your video player here
  };

  const handleNoteCreate = (noteData) => {
    const newNote = {
      ...noteData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setNotes(prev => [...prev, newNote]);
  };

  return (
    <InteractiveTranscriptNavigation
      transcript={transcriptData}
      videoUrl={videoUrl}
      currentTime={currentTime}
      isPlaying={isPlaying}
      onTimeSeek={handleTimeSeek}
      notes={notes}
      onNoteCreate={handleNoteCreate}
      bookmarks={bookmarks}
      onBookmarkToggle={handleBookmarkToggle}
    />
  );
};
```

### Advanced Configuration
```tsx
<InteractiveTranscriptNavigation
  transcript={transcript}
  videoUrl={videoUrl}
  currentTime={currentTime}
  isPlaying={isPlaying}
  onTimeSeek={handleTimeSeek}
  onPlay={handlePlay}
  onPause={handlePause}
  notes={notes}
  onNoteCreate={handleNoteCreate}
  onNoteUpdate={handleNoteUpdate}
  onNoteDelete={handleNoteDelete}
  bookmarks={bookmarks}
  onBookmarkToggle={handleBookmarkToggle}
  showVideoPlayer={true}
  allowNotes={true}
  allowBookmarks={true}
  allowExport={true}
/>
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate between interactive elements |
| `Enter` | Activate focused element |
| `Escape` | Close dialogs and menus |
| `Ctrl+Enter` | Save note (in note editor) |
| `Ctrl+F` | Focus search input |
| `Arrow Up/Down` | Navigate search results |

## Accessibility Features

- **Screen Reader Support**: All components include proper ARIA labels and descriptions
- **Keyboard Navigation**: Full keyboard accessibility for all interactive elements
- **High Contrast**: Supports high contrast themes and custom color schemes
- **Focus Management**: Proper focus handling for dialogs and dynamic content
- **Semantic HTML**: Uses semantic HTML elements for better screen reader compatibility

## Performance Optimizations

- **Virtual Scrolling**: Efficiently handles large transcripts with thousands of segments
- **Debounced Search**: Search input is debounced to prevent excessive API calls
- **Memoized Components**: React.memo and useMemo used to prevent unnecessary re-renders
- **Lazy Loading**: Components and features are loaded on-demand
- **Efficient Updates**: Only re-renders components when relevant data changes

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Testing

The component suite includes comprehensive tests:

- **Unit Tests**: Individual component functionality
- **Integration Tests**: Component interaction and data flow
- **Accessibility Tests**: WCAG compliance and screen reader compatibility
- **Performance Tests**: Large dataset handling and rendering performance

Run tests with:
```bash
npm test src/components/transcript
```

## Demo

Visit `/demo/transcript` in the application to see a fully functional demonstration of all features.

## Contributing

When contributing to the transcript components:

1. Follow the existing TypeScript patterns
2. Include comprehensive tests for new features
3. Update this README for any new functionality
4. Ensure accessibility compliance
5. Test with large datasets for performance

## License

This component is part of the YouTube Learning Platform and follows the same license terms.