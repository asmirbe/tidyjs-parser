export class ImportParserError extends Error {
  constructor(message: string, public originalmports: string) {
    super(message);
    this.name = 'ImportParserError';
  }
}
