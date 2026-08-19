'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { getCustomZerfEmoji } from '@/lib/custom-emojis'

interface ZerfAvatarProps {
  emoji?: string | null
  className?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  monochrome?: boolean
  showGlow?: boolean
  title?: string
}

export function ZerfAvatar({
  emoji = 'zerfik_spirit',
  className,
  size = 'md',
  monochrome = true,
  showGlow = false,
  title,
}: ZerfAvatarProps) {
  const currentKey = emoji || 'zerfik_spirit'
  const custom = getCustomZerfEmoji(currentKey)

  const sizeClasses = {
    xs: 'w-4 h-4 text-[10px]',
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-11 h-11 text-xl',
    xl: 'w-14 h-14 text-2xl',
  }[size]

  const iconSizes = {
    xs: 16,
    sm: 22,
    md: 28,
    lg: 40,
    xl: 48,
  }[size]

  // Render Custom Hand-crafted Zerf Vector Graphic
  if (custom) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center select-none shrink-0 relative transition-transform duration-200',
          sizeClasses,
          monochrome && 'grayscale contrast-125 hover:grayscale-0 hover:contrast-100',
          className
        )}
        title={title || custom.name}
      >
        {renderCustomSvg(custom.id, iconSizes, monochrome)}
      </span>
    )
  }

  // Handle standard unicode emojis or text avatars
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center select-none shrink-0 emoji-symbol leading-none transition-transform duration-200',
        sizeClasses,
        monochrome && 'grayscale contrast-125 hover:grayscale-0 hover:contrast-100',
        className
      )}
      style={{ fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif' }}
      title={title || (typeof emoji === 'string' ? emoji : '')}
    >
      {emoji || '✦'}
    </span>
  )
}

/* eslint-disable @next/next/no-img-element */
import Image from 'next/image'

function renderCustomSvg(id: string, s: number, monochrome: boolean) {
  // ── 1. Зерфик Пиксельный Дух Маскот (Увеличенный и четкий) ──
  if (id === 'zerfik_spirit' || id.startsWith('zerfik_')) {
    return (
      <div
        className="relative flex items-center justify-center select-none overflow-visible animate-[bounce_3s_ease-in-out_infinite] drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]"
        style={{ width: s, height: s }}
      >
        <img
          src="/images/zerfik_spirit.png"
          alt="Зерфик Дух"
          width={s}
          height={s}
          className="w-full h-full object-contain pointer-events-none image-rendering-pixelated scale-120 transform transition-transform"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
    )
  }

  // ── 2. Милые Лица в Кружочке (Аватары с глазами-звездочками, румянцем и эмоциями) ──
  switch (id) {
    case 'face_star_eyes':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.6" />
          {/* Left Star Eye */}
          <path d="M8 7.5L8.9 9.5L11 9.8L9.5 11.2L9.8 13.3L8 12.3L6.2 13.3L6.5 11.2L5 9.8L7.1 9.5L8 7.5Z" fill="currentColor" />
          {/* Right Star Eye */}
          <path d="M16 7.5L16.9 9.5L19 9.8L17.5 11.2L17.8 13.3L16 12.3L14.2 13.3L14.5 11.2L13 9.8L15.1 9.5L16 7.5Z" fill="currentColor" />
          {/* Cute Smile */}
          <path d="M9.5 15C10.2 16.5 13.8 16.5 14.5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          {/* Rosy Cheeks */}
          <ellipse cx="6" cy="14" rx="1.4" ry="0.8" fill="currentColor" fillOpacity="0.45" />
          <ellipse cx="18" cy="14" rx="1.4" ry="0.8" fill="currentColor" fillOpacity="0.45" />
        </svg>
      )

    case 'face_sparkle_wink':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.6" />
          {/* Left Star Eye */}
          <path d="M8 7.5L8.9 9.5L11 9.8L9.5 11.2L9.8 13.3L8 12.3L6.2 13.3L6.5 11.2L5 9.8L7.1 9.5L8 7.5Z" fill="currentColor" />
          {/* Right Winking Curved Eye */}
          <path d="M14 10.5C15 9.2 17 9.2 18 10.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          {/* Cute Wink Smile */}
          <path d="M9.5 14.5C10.5 16.8 13.5 16.8 14.5 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          {/* Cheeks */}
          <circle cx="6" cy="13.5" r="1.3" fill="currentColor" fillOpacity="0.4" />
          <circle cx="18" cy="13.5" r="1.3" fill="currentColor" fillOpacity="0.4" />
        </svg>
      )

    case 'face_cute_blush':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.6" />
          {/* Happy Closed Eyes ^ ^ */}
          <path d="M6.5 10.5C7.5 8.2 9.5 8.2 10.5 10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M13.5 10.5C14.5 8.2 16.5 8.2 17.5 10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          {/* Cute Cat-like Smile */}
          <path d="M10 14.5C11 16 13 16 14 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          {/* Blush Cheeks */}
          <circle cx="5.8" cy="13.5" r="1.6" fill="currentColor" fillOpacity="0.45" />
          <circle cx="18.2" cy="13.5" r="1.6" fill="currentColor" fillOpacity="0.45" />
        </svg>
      )

    case 'face_heart_eyes':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.6" />
          {/* Left Heart Eye */}
          <path d="M8 8.5C6.5 7 5 8.5 5 10C5 12 8 13.5 8 13.5C8 13.5 11 12 11 10C11 8.5 9.5 7 8 8.5Z" fill="currentColor" />
          {/* Right Heart Eye */}
          <path d="M16 8.5C14.5 7 13 8.5 13 10C13 12 16 13.5 16 13.5C16 13.5 19 12 19 10C19 8.5 17.5 7 16 8.5Z" fill="currentColor" />
          {/* Happy Open Smile */}
          <path d="M9.5 15.5C10.5 17 13.5 17 14.5 15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )

    case 'face_kitty_cute':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.6" />
          {/* Cat Ears */}
          <path d="M5.5 6L4 10.5L8.5 8.5L5.5 6Z" fill="currentColor" />
          <path d="M18.5 6L20 10.5L15.5 8.5L18.5 6Z" fill="currentColor" />
          {/* Big Sparkle Dot Eyes */}
          <circle cx="8" cy="11.5" r="1.6" fill="currentColor" />
          <circle cx="16" cy="11.5" r="1.6" fill="currentColor" />
          {/* Cat Mouth :3 */}
          <path d="M9.5 14C10.5 15.2 12 14.2 12 13.5C12 14.2 13.5 15.2 14.5 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          {/* Cute Whiskers */}
          <line x1="3" y1="12" x2="5.5" y2="12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="3" y1="14" x2="5.5" y2="13.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="21" y1="12" x2="18.5" y2="12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="21" y1="14" x2="18.5" y2="13.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )

    case 'face_happy_smile':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.6" />
          {/* Big Smiling Eyes */}
          <path d="M7 10C8 8.5 10 8.5 11 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M13 10C14 8.5 16 8.5 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          {/* Joyful Open Mouth */}
          <path d="M8.5 13.5C8.5 16.5 15.5 16.5 15.5 13.5Z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          {/* Cheeks */}
          <circle cx="6" cy="13" r="1.3" fill="currentColor" fillOpacity="0.4" />
          <circle cx="18" cy="13" r="1.3" fill="currentColor" fillOpacity="0.4" />
        </svg>
      )

    case 'face_sleepy_dream':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.6" />
          {/* Peaceful Closed Eyes */}
          <path d="M6.5 11C7.5 12.5 9.5 12.5 10.5 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M13.5 11C14.5 12.5 16.5 12.5 17.5 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          {/* Gentle Smile */}
          <path d="M10.5 14.5C11.5 15.5 12.5 15.5 13.5 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          {/* Little Star Sleep Sparkle */}
          <path d="M16 6H18L16 8H18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )

    case 'face_cyber_pixel':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.6" />
          {/* Pixel Eyes */}
          <rect x="6" y="8" width="3" height="3" fill="currentColor" />
          <rect x="15" y="8" width="3" height="3" fill="currentColor" />
          {/* Pixel Blush */}
          <rect x="5" y="12" width="2" height="1" fill="currentColor" fillOpacity="0.5" />
          <rect x="17" y="12" width="2" height="1" fill="currentColor" fillOpacity="0.5" />
          {/* Pixel Smile */}
          <rect x="8" y="14" width="8" height="2" fill="currentColor" />
          <rect x="7" y="13" width="2" height="1" fill="currentColor" />
          <rect x="15" y="13" width="2" height="1" fill="currentColor" />
        </svg>
      )

    case 'face_spark_hero':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.6" />
          {/* Cool eyes */}
          <path d="M6 10L10 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M18 10L14 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="8" cy="12" r="1.5" fill="currentColor" />
          <circle cx="16" cy="12" r="1.5" fill="currentColor" />
          {/* Confident Smile */}
          <path d="M10 15C11 16.5 13.5 16 14.5 14.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
  }

  // ── 2. Реальные нейросети (Ч/Б Монохромные) ──
  switch (id) {
    case 'ai_deepseek':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3.5" fill="currentColor" />
        </svg>
      )

    case 'ai_openai':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" fill="currentColor" fillOpacity="0.15" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      )

    case 'ai_claude':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 3V21M3 12H21M5.64 5.64L18.36 18.36M5.64 18.36L18.36 5.64" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      )

    case 'ai_perplexity':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.1" />
          <path d="M12 6v12M6 12h12M7.5 7.5l9 9M7.5 16.5l9-9" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        </svg>
      )

    case 'ai_gemini':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z" fill="currentColor" />
        </svg>
      )

    case 'ai_midjourney':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 19L12 4L20 19H4Z" fill="currentColor" fillOpacity="0.15" />
          <path d="M12 4V19M4 19C8 16 16 16 20 19" />
        </svg>
      )

    case 'ai_groq':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.6" />
          <path d="M13 7L9 13H15L11 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )

    case 'ai_mistral':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="4" width="4" height="4" fill="currentColor" />
          <rect x="10" y="4" width="4" height="4" fill="currentColor" />
          <rect x="16" y="4" width="4" height="4" fill="currentColor" />
          <rect x="7" y="10" width="4" height="4" fill="currentColor" />
          <rect x="13" y="10" width="4" height="4" fill="currentColor" />
          <rect x="10" y="16" width="4" height="4" fill="currentColor" />
        </svg>
      )

    case 'ai_llama':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8.5" cy="12" r="4.5" fill="currentColor" fillOpacity="0.2" />
          <circle cx="15.5" cy="12" r="4.5" fill="currentColor" fillOpacity="0.2" />
          <path d="M12 7.5C10 5 6 5 4 8C2 11 3 16 7 18C10 19.5 12 18 12 18C12 18 14 19.5 17 18C21 16 22 11 20 8C18 5 14 5 12 7.5Z" />
        </svg>
      )

    case 'ai_cursor':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 3L19 12L12 13L9 20L5 3Z" fill="currentColor" fillOpacity="0.2" />
        </svg>
      )

    case 'ai_v0':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 7L10 17L14 7M14 12C14 9.5 16 8 18 8C20 8 22 9.5 22 12C22 14.5 20 16 18 16C16 16 14 14.5 14 12Z" />
        </svg>
      )

    case 'ai_huggingface':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.15" />
          <circle cx="9" cy="10" r="1.5" fill="currentColor" />
          <circle cx="15" cy="10" r="1.5" fill="currentColor" />
          <path d="M8 15C9.5 17 14.5 17 16 15" />
          <path d="M4 14C3 15 3 17 5 18C7 19 8 17 8 15" />
          <path d="M20 14C21 15 21 17 19 18C17 19 16 17 16 15" />
        </svg>
      )

    case 'ai_qwen':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <polygon points="12,2 15,9 22,12 15,15 12,22 9,15 2,12 9,9" fill="currentColor" fillOpacity="0.2" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      )

    case 'ai_elevenlabs':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <line x1="5" y1="10" x2="5" y2="14" />
          <line x1="8" y1="7" x2="8" y2="17" />
          <line x1="11" y1="4" x2="11" y2="20" />
          <line x1="14" y1="7" x2="14" y2="17" />
          <line x1="17" y1="9" x2="17" y2="15" />
          <line x1="20" y1="11" x2="20" y2="13" />
        </svg>
      )

    case 'ai_apple_intelligence':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="8" fill="currentColor" fillOpacity="0.15" />
          <path d="M8 12C8 9 12 7 12 12C12 17 16 15 16 12" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      )

    case 'ai_copilot':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="6" width="16" height="12" rx="4" fill="currentColor" fillOpacity="0.15" />
          <circle cx="9" cy="12" r="2" fill="currentColor" />
          <circle cx="15" cy="12" r="2" fill="currentColor" />
          <line x1="12" y1="2" x2="12" y2="6" />
        </svg>
      )

    case 'ai_suno':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.15" />
          <path d="M8 12C8 10 10 9 12 9C14 9 16 10 16 12C16 14 14 15 12 15C10 15 8 14 8 12Z" />
          <line x1="12" y1="3" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="21" />
        </svg>
      )

    case 'ai_runway':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="5" width="18" height="14" rx="3" fill="currentColor" fillOpacity="0.15" />
          <polygon points="10,9 16,12 10,15" fill="currentColor" />
        </svg>
      )

    case 'ai_flux':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.15" />
          <path d="M7 14C9 8 15 8 17 14" />
          <circle cx="12" cy="8" r="2" fill="currentColor" />
        </svg>
      )

    case 'ai_kling':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <circle cx="7" cy="12" r="4" fill="currentColor" fillOpacity="0.2" />
          <circle cx="17" cy="12" r="4" fill="currentColor" fillOpacity="0.2" />
          <line x1="7" y1="12" x2="17" y2="12" />
        </svg>
      )

    // ── 3. Экосистема Zerf (Ч/Б Vector) ──
    case 'zerf_ai':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="5" fill="currentColor" />
          <circle cx="16" cy="16" r="9" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" strokeOpacity="0.7" />
          <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" />
          <circle cx="16" cy="3" r="1.8" fill="currentColor" />
          <circle cx="16" cy="29" r="1.8" fill="currentColor" />
          <circle cx="3" cy="16" r="1.8" fill="currentColor" />
          <circle cx="29" cy="16" r="1.8" fill="currentColor" />
        </svg>
      )

    case 'zerf_brain':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="14" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2" />
          <path d="M14 8C11 8 8 10.5 8 14C8 16 9 17.5 9.5 19C10 20.5 11 23 14 24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <path d="M18 8C21 8 24 10.5 24 14C24 16 23 17.5 22.5 19C22 20.5 21 23 18 24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <line x1="16" y1="8" x2="16" y2="24" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 2" />
          <circle cx="12" cy="13" r="1.2" fill="currentColor" />
          <circle cx="20" cy="13" r="1.2" fill="currentColor" />
        </svg>
      )

    case 'zerf_crystal':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="16,3 27,9 27,23 16,29 5,23 5,9" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.4" />
          <line x1="16" y1="3" x2="16" y2="29" stroke="currentColor" strokeWidth="1" strokeOpacity="0.6" />
          <line x1="5" y1="9" x2="27" y2="23" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.5" />
          <line x1="5" y1="23" x2="27" y2="9" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.5" />
          <polygon points="16,10 21,13 21,19 16,22 11,19 11,13" fill="currentColor" />
        </svg>
      )

    case 'zerf_cli':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="6" width="24" height="20" rx="4" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.4" />
          <path d="M9 13L13 16L9 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="15" y1="19" x2="22" y2="19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )

    case 'zerf_matrix':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="16" y1="6" x2="16" y2="19" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.6" />
          {/* Graph Nodes */}
          <circle cx="16" cy="6" r="2.8" fill="currentColor" />
          <circle cx="7" cy="14" r="2.4" fill="currentColor" />
          <circle cx="25" cy="14" r="2.4" fill="currentColor" />
          <circle cx="16" cy="19" r="2.5" fill="currentColor" />
          <circle cx="11" cy="25" r="2.2" fill="currentColor" />
          <circle cx="21" cy="25" r="2.2" fill="currentColor" />
        </svg>
      )

    case 'zerf_lightning':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="13.5" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.2" />
          {/* Cyber Lightning Bolt */}
          <polygon points="17,4 8,17 15,17 13,28 24,14 17,14" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      )

    case 'zerf_crown':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="14" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2" />
          {/* Imperial Creator Crown */}
          <path d="M7 23H25L24 13L19 18L16 9L13 18L8 13L7 23Z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          {/* Crown Jewels */}
          <circle cx="8" cy="12" r="1.5" fill="currentColor" />
          <circle cx="16" cy="8" r="1.8" fill="currentColor" />
          <circle cx="24" cy="12" r="1.5" fill="currentColor" />
          <rect x="10" y="21" width="12" height="1.8" rx="0.9" fill="currentColor" />
        </svg>
      )

    case 'zerf_shield':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Security Shield */}
          <path d="M16 4L26 8V16C26 22 16 27 16 27C16 27 6 22 6 16V8L16 4Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" />
          {/* Vault Keyhole */}
          <circle cx="16" cy="13" r="2.5" fill="currentColor" />
          <polygon points="14.8,14.5 17.2,14.5 18,20 14,20" fill="currentColor" />
        </svg>
      )

    case 'zerf_streak':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="13.5" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.2" />
          {/* Geometric Fire Flame */}
          <path d="M16 5C16 5 21 11 21 16C21 19.5 18.5 24 16 25C13.5 24 11 19.5 11 16C11 11 16 5 16 5Z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.4" />
          {/* Inner Spark */}
          <path d="M16 12C16 12 18.5 16 18.5 18C18.5 20 17 22 16 22.5C15 22 13.5 20 13.5 18C13.5 16 16 12 16 12Z" fill="currentColor" />
        </svg>
      )

    default:
      return null
  }
}
