/**
 * Authoring contract component library.
 * Users instruct external AI tools to emit these components so slides are
 * fully editable and exportable. They render normally in the sandbox and
 * expose structured metadata via data attributes for the host bridge.
 */

import React, { type CSSProperties, type ReactNode } from 'react';
import { SLIDE_WIDTH, SLIDE_HEIGHT } from '@/types/slide';

export interface PresentationDeckProps {
  children: ReactNode;
  width?: number;
  height?: number;
  className?: string;
}

export function PresentationDeck({
  children,
  width = SLIDE_WIDTH,
  height = SLIDE_HEIGHT,
  className,
}: PresentationDeckProps) {
  return (
    <div
      data-slidecraft="deck"
      data-width={width}
      data-height={height}
      className={className}
      style={{ width, height, position: 'relative' }}
    >
      {children}
    </div>
  );
}

export interface SlideProps {
  children?: ReactNode;
  id?: string;
  background?: string;
  className?: string;
  style?: CSSProperties;
}

export function Slide({ children, id, background = '#0E111B', className, style }: SlideProps) {
  return (
    <div
      data-slidecraft="slide"
      data-slide="true"
      data-slide-id={id}
      className={className}
      style={{
        width: SLIDE_WIDTH,
        height: SLIDE_HEIGHT,
        position: 'relative',
        overflow: 'hidden',
        background,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export interface SlideTextProps {
  children?: ReactNode;
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontWeight?: number | string;
  color?: string;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  className?: string;
  style?: CSSProperties;
}

export function SlideText({
  children,
  id,
  x = 0,
  y = 0,
  width = 400,
  height = 60,
  fontSize = 24,
  fontWeight = 400,
  color = '#F7F7FC',
  fontFamily = 'Inter, sans-serif',
  textAlign = 'left',
  lineHeight = 1.3,
  className,
  style,
}: SlideTextProps) {
  return (
    <div
      data-slidecraft="text"
      data-element-id={id}
      data-x={x}
      data-y={y}
      data-width={width}
      data-height={height}
      className={className}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        fontSize,
        fontWeight,
        color,
        fontFamily,
        textAlign,
        lineHeight,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export interface SlideImageProps {
  src: string;
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none';
  borderRadius?: number;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}

export function SlideImage({
  src,
  id,
  x = 0,
  y = 0,
  width = 400,
  height = 300,
  objectFit = 'cover',
  borderRadius = 0,
  alt = '',
  className,
  style,
}: SlideImageProps) {
  return (
    <img
      data-slidecraft="image"
      data-element-id={id}
      data-x={x}
      data-y={y}
      data-width={width}
      data-height={height}
      src={src}
      alt={alt}
      className={className}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        objectFit,
        borderRadius,
        ...style,
      }}
    />
  );
}

export interface SlideShapeProps {
  id?: string;
  shapeType?: 'rectangle' | 'circle' | 'ellipse' | 'triangle' | 'rounded-rectangle';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  className?: string;
  style?: CSSProperties;
}

export function SlideShape({
  id,
  shapeType = 'rectangle',
  x = 0,
  y = 0,
  width = 200,
  height = 200,
  fill = '#8B7CFF',
  stroke,
  strokeWidth = 0,
  borderRadius = 0,
  className,
  style,
}: SlideShapeProps) {
  const isCircle = shapeType === 'circle' || shapeType === 'ellipse';
  return (
    <div
      data-slidecraft="shape"
      data-element-id={id}
      data-shape-type={shapeType}
      data-x={x}
      data-y={y}
      data-width={width}
      data-height={height}
      className={className}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        background: fill,
        border: strokeWidth ? `${strokeWidth}px solid ${stroke}` : undefined,
        borderRadius: isCircle ? '50%' : borderRadius,
        ...style,
      }}
    />
  );
}

export interface SlideLineProps {
  id?: string;
  x?: number;
  y?: number;
  x2?: number;
  y2?: number;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
}

export function SlideLine({
  id,
  x = 0,
  y = 0,
  x2 = 200,
  y2 = 0,
  stroke = '#F7F7FC',
  strokeWidth = 2,
  className,
}: SlideLineProps) {
  const left = Math.min(x, x2);
  const top = Math.min(y, y2);
  const width = Math.abs(x2 - x) || strokeWidth;
  const height = Math.abs(y2 - y) || strokeWidth;
  return (
    <svg
      data-slidecraft="line"
      data-element-id={id}
      data-x={x}
      data-y={y}
      data-x2={x2}
      data-y2={y2}
      className={className}
      style={{ position: 'absolute', left, top, width, height, overflow: 'visible' }}
    >
      <line
        x1={x - left}
        y1={y - top}
        x2={x2 - left}
        y2={y2 - top}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

export interface SlideGroupProps {
  children?: ReactNode;
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  className?: string;
  style?: CSSProperties;
}

export function SlideGroup({
  children,
  id,
  x = 0,
  y = 0,
  width = 400,
  height = 300,
  className,
  style,
}: SlideGroupProps) {
  return (
    <div
      data-slidecraft="group"
      data-element-id={id}
      data-x={x}
      data-y={y}
      data-width={width}
      data-height={height}
      className={className}
      style={{ position: 'absolute', left: x, top: y, width, height, ...style }}
    >
      {children}
    </div>
  );
}
