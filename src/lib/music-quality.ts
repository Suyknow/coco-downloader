// Shared by search results and playlist metadata. These are channel capabilities,
// not a guarantee that a particular song is available in every quality.
export const NETEASE_QUALITY_OPTIONS = [
  { value: 'standard', label: '标准音质', quality: '128', format: 'mp3' },
  { value: 'exhigh', label: '极高音质', quality: '320', format: 'mp3' },
  { value: 'lossless', label: '无损音质', quality: 'lossless', format: 'flac/mp3' },
];
