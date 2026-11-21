import React from 'react';

/** SunPower mark from the design template (sun-bowl arcs + rays + wordmark). */
export default function SunPowerLogo({ variant = 'dark', size = 'md', className = '' }) {
  const color = variant === 'light' ? '#FFFFFF' : '#1B3E5E';
  const sizeClass =
    { xs: 'h-8 w-auto', sm: 'h-11 w-auto', md: 'h-14 w-auto', lg: 'h-20 w-auto' }[size] || 'h-14 w-auto';

  return (
    <span className={`inline-flex items-center select-none shrink-0 ${className}`}>
      <svg viewBox="0 0 220 156" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sun Power logo" className={sizeClass}>
        <path d="M 46 28 C 52 54, 72 68, 92 72" stroke={color} strokeWidth="3.8" strokeLinecap="round" />
        <path d="M 174 28 C 168 54, 148 68, 128 72" stroke={color} strokeWidth="3.8" strokeLinecap="round" />
        <line x1="44" y1="50" x2="50" y2="47" stroke={color} strokeWidth="3.4" strokeLinecap="round" />
        <line x1="56" y1="68" x2="66" y2="59" stroke={color} strokeWidth="3.4" strokeLinecap="round" />
        <line x1="176" y1="50" x2="170" y2="47" stroke={color} strokeWidth="3.4" strokeLinecap="round" />
        <line x1="164" y1="68" x2="154" y2="59" stroke={color} strokeWidth="3.4" strokeLinecap="round" />
        <text
          x="110"
          y="91"
          textAnchor="middle"
          fill={color}
          fontFamily="Inter, -apple-system, BlinkMacSystemFont, sans-serif"
          fontWeight="800"
          fontSize="24"
          letterSpacing="3.4"
        >
          SUN POWER
        </text>
        <line x1="57" y1="101" x2="55" y2="105" stroke={color} strokeWidth="3.4" strokeLinecap="round" />
        <line x1="87" y1="99" x2="79" y2="127" stroke={color} strokeWidth="3.6" strokeLinecap="round" />
        <line x1="77" y1="135" x2="74" y2="145" stroke={color} strokeWidth="3.6" strokeLinecap="round" />
        <line x1="110" y1="99" x2="110" y2="149" stroke={color} strokeWidth="3.8" strokeLinecap="round" />
        <line x1="133" y1="99" x2="141" y2="127" stroke={color} strokeWidth="3.6" strokeLinecap="round" />
        <line x1="143" y1="135" x2="146" y2="145" stroke={color} strokeWidth="3.6" strokeLinecap="round" />
        <line x1="163" y1="101" x2="165" y2="105" stroke={color} strokeWidth="3.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}
