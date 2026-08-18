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
    sm: 'w-5 h-5 text-xs',
    md: 'w-7 h-7 text-sm',
    lg: 'w-10 h-10 text-xl',
    xl: 'w-12 h-12 text-2xl',
  }[size]

  const iconSizes = {
    xs: 14,
    sm: 18,
    md: 24,
    lg: 34,
    xl: 40,
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

function renderCustomSvg(id: string, s: number, monochrome: boolean) {
  switch (id) {
    case 'zerfik_spirit':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
          {/* Outer Spirit Aura */}
          <circle cx="16" cy="16" r="14" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" />
          {/* Cute Spirit Head */}
          <path d="M16 6C10.5 6 6.5 10 6.5 15.5C6.5 21 10.5 25 16 25C21.5 25 25.5 21 25.5 15.5C25.5 10 21.5 6 16 6Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.5" />
          {/* Starry Eyes (✧ ✧) */}
          <path d="M11.5 13.5L12 15L13.5 15.5L12 16L11.5 17.5L11 16L9.5 15.5L11 15L11.5 13.5Z" fill="currentColor" />
          <path d="M20.5 13.5L21 15L22.5 15.5L21 16L20.5 17.5L20 16L18.5 15.5L20 15L20.5 13.5Z" fill="currentColor" />
          {/* Happy Smile ‿ */}
          <path d="M13.5 19C14.5 20.2 17.5 20.2 18.5 19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          {/* Antenna Sparkle on top ✦ */}
          <path d="M16 2.5L16.6 4.4L18.5 5L16.6 5.6L16 7.5L15.4 5.6L13.5 5L15.4 4.4L16 2.5Z" fill="currentColor" />
        </svg>
      )

    case 'zerfik_focus':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
          {/* Outer Precision Ring */}
          <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 2" strokeOpacity="0.6" />
          {/* Spirit Base */}
          <rect x="7" y="7" width="18" height="18" rx="9" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" />
          {/* Crosshair Focus Pupils (✧ ✧) */}
          <circle cx="11.5" cy="15.5" r="2.2" fill="currentColor" />
          <circle cx="20.5" cy="15.5" r="2.2" fill="currentColor" />
          <line x1="8" y1="15.5" x2="15" y2="15.5" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.5" />
          <line x1="17" y1="15.5" x2="24" y2="15.5" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.5" />
          {/* Focused Smile */}
          <line x1="14" y1="20" x2="18" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          {/* Top Diamond */}
          <polygon points="16,3 18,5.5 16,8 14,5.5" fill="currentColor" />
        </svg>
      )

    case 'zerfik_wink':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
          <circle cx="16" cy="16" r="13.5" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.4" />
          {/* Left Star Eye ✧ */}
          <path d="M11.5 13L12 14.5L13.5 15L12 15.5L11.5 17L11 15.5L9.5 15L11 14.5L11.5 13Z" fill="currentColor" />
          {/* Right Winking Eye ^ / ~ */}
          <path d="M18.5 16C19.5 14 21.5 14 22.5 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          {/* Cute Smirk ‿ */}
          <path d="M14 19.5C15.5 21 18.5 20.5 19.5 19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          {/* Floating Sparkle */}
          <circle cx="24.5" cy="8.5" r="1.5" fill="currentColor" />
        </svg>
      )

    case 'zerfik_zen':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
          <circle cx="16" cy="16" r="13.5" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.3" />
          {/* Zen Eyes (˘ ˘) */}
          <path d="M9.5 15C10.5 13.5 12.5 13.5 13.5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M18.5 15C19.5 13.5 21.5 13.5 22.5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          {/* Serene Smile */}
          <path d="M14 19C15 20 17 20 18 19" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          {/* Meditative Aura Dots */}
          <circle cx="16" cy="6" r="1" fill="currentColor" />
          <circle cx="16" cy="9" r="1.2" fill="currentColor" />
        </svg>
      )

    case 'zerfik_cyber':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
          {/* Cyber Head Shield */}
          <path d="M6 9L16 4L26 9V17C26 23 16 28 16 28C16 28 6 23 6 17V9Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.4" />
          {/* Neon Visor Bar */}
          <rect x="9" y="12" width="14" height="4" rx="2" fill="currentColor" />
          {/* Visor Glitch Nodes */}
          <circle cx="12" cy="14" r="0.8" fill="#000" />
          <circle cx="16" cy="14" r="0.8" fill="#000" />
          <circle cx="20" cy="14" r="0.8" fill="#000" />
          {/* Cyber Mouth Grid */}
          <line x1="13" y1="20" x2="19" y2="20" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="16" y1="19" x2="16" y2="22" stroke="currentColor" strokeWidth="1" />
        </svg>
      )

    case 'zerf_ai':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Central AI Nucleus */}
          <circle cx="16" cy="16" r="5" fill="currentColor" />
          <circle cx="16" cy="16" r="9" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" strokeOpacity="0.7" />
          <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" />
          {/* Orbiting Quantum Nodes */}
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
          {/* Left Hemisphere */}
          <path d="M14 8C11 8 8 10.5 8 14C8 16 9 17.5 9.5 19C10 20.5 11 23 14 24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          {/* Right Hemisphere */}
          <path d="M18 8C21 8 24 10.5 24 14C24 16 23 17.5 22.5 19C22 20.5 21 23 18 24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          {/* Central Cortex Synapse */}
          <line x1="16" y1="8" x2="16" y2="24" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 2" />
          {/* Neural Synapse Nodes */}
          <circle cx="12" cy="13" r="1.2" fill="currentColor" />
          <circle cx="20" cy="13" r="1.2" fill="currentColor" />
          <circle cx="13" cy="18" r="1.2" fill="currentColor" />
          <circle cx="19" cy="18" r="1.2" fill="currentColor" />
        </svg>
      )

    case 'zerf_crystal':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Faceted Entropy Crystal Hexagon */}
          <polygon points="16,3 27,9 27,23 16,29 5,23 5,9" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.4" />
          {/* Internal Facets */}
          <line x1="16" y1="3" x2="16" y2="29" stroke="currentColor" strokeWidth="1.2" />
          <line x1="5" y1="9" x2="16" y2="16" stroke="currentColor" strokeWidth="1.2" />
          <line x1="27" y1="9" x2="16" y2="16" stroke="currentColor" strokeWidth="1.2" />
          <line x1="5" y1="23" x2="16" y2="16" stroke="currentColor" strokeWidth="1.2" />
          <line x1="27" y1="23" x2="16" y2="16" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="16" cy="16" r="2.5" fill="currentColor" />
        </svg>
      )

    case 'zerf_cli':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Terminal Window Box */}
          <rect x="4" y="6" width="24" height="20" rx="4" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.4" />
          {/* Header Bar */}
          <line x1="4" y1="12" x2="28" y2="12" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
          <circle cx="8" cy="9" r="1" fill="currentColor" />
          <circle cx="11" cy="9" r="1" fill="currentColor" />
          <circle cx="14" cy="9" r="1" fill="currentColor" />
          {/* Prompt Arrow > */}
          <path d="M9 17L13 20L9 23" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Terminal Cursor Block _ */}
          <line x1="16" y1="23" x2="22" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )

    case 'zerf_matrix':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Knowledge Graph Topology */}
          <line x1="16" y1="6" x2="7" y2="14" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.6" />
          <line x1="16" y1="6" x2="25" y2="14" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.6" />
          <line x1="7" y1="14" x2="11" y2="25" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.6" />
          <line x1="25" y1="14" x2="21" y2="25" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.6" />
          <line x1="7" y1="14" x2="25" y2="14" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" />
          <line x1="11" y1="25" x2="21" y2="25" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.6" />
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
