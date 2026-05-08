export type MarkdownHeadingLevel = 2 | 3 | 4 | 5;

export type MarkdownToolId =
  | 'bold'
  | 'italic'
  | 'quote'
  | 'link'
  | 'image'
  | 'code'
  | 'codeBlock'
  | 'list'
  | 'orderedList'
  | 'taskList'
  | 'table';

export type MarkdownToolbarCommand =
  | {
      id: number;
      kind: 'tool';
      toolId: MarkdownToolId;
    }
  | {
      id: number;
      kind: 'heading';
      level: MarkdownHeadingLevel;
    }
  | {
      id: number;
      kind: 'insert';
      text: string;
    };
