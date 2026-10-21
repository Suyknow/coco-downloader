import { cn } from '@/lib/utils';

export function BrowserDownloadNotice({ className }: { className?: string }) {
  return (
    <p className={cn('text-xs leading-5 text-[#404752] dark:text-[#c6c6c7]', className)}>
      部分音源需要交给浏览器处理。浏览器可能限制连续下载，批量下载可能需要逐个点击确认，网页也无法跟踪后续进度。
      如需批量下载，可考虑
      <a
        href="https://github.com/markcxx/coco-downloader/releases"
        target="_blank"
        rel="noopener noreferrer"
        className="mx-1 font-medium text-[#005faa] underline underline-offset-2 dark:text-[#a3c9ff]"
      >
        使用客户端
      </a>
      。
    </p>
  );
}
