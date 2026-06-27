import { Image, Video } from 'lucide-react';
import type { GenerationMode } from '../../types';

export function ModeIcon({ mode }: { mode: GenerationMode }) {
  switch (mode) {
    case 'text': return <Video className="w-4 h-4" />;
    case 'image':
    case 'imageTail':
    case 'multiImage': return <Image className="w-4 h-4" />;
    case 'multiModal': return <Video className="w-4 h-4" />;
    default: return <Video className="w-4 h-4" />;
  }
}
