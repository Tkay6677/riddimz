declare module 'lrc-parser' {
  interface LyricScript {
    time: number;
    text: string;
  }

  class LRCParser {
    scripts: LyricScript[];
    parse(lrc: string): void;
  }

  export default LRCParser;
} 