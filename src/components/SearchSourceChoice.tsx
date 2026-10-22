"use client";

import { SelectMenu } from '@/components/SelectMenu';

export function SearchSourceChoice({ value, onChange, disabled = false }: {
  value: 'official' | 'channel';
  onChange: (value: 'official' | 'channel') => void;
  disabled?: boolean;
}) {
  return <div className="mt-3 flex w-full max-w-2xl items-center justify-end gap-2">
    <span className="text-xs text-[#73777f] dark:text-[#c6c6c7]">搜索方式</span>
    <SelectMenu
      label="搜索方式"
      value={value}
      onChange={next => onChange(next === 'official' ? 'official' : 'channel')}
      options={[
        { value: 'official', label: '官方搜索' },
        { value: 'channel', label: '渠道搜索' },
      ]}
      disabled={disabled}
    />
  </div>;
}
