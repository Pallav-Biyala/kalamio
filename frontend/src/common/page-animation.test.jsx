import { describe, it, expect, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// Capture what AnimationWrapper hands framer, so we can assert on the entrance decision without
// needing a real animation frame (jsdom/hidden tabs don't run rAF, so timing can't be observed).
const motionProps = [];
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }) => children,
  motion: {
    div: ({ children, initial, animate, transition, ...rest }) => {
      motionProps.push({ initial, animate, transition });
      return <div {...rest}>{children}</div>;
    },
  },
}));

import AnimationWrapper from './page-animation';

const last = () => motionProps[motionProps.length - 1];

describe('AnimationWrapper — entrance plays once per id', () => {
  it('animates the FIRST time an id mounts', () => {
    render(<AnimationWrapper once="blog-a"><p>a</p></AnimationWrapper>);
    expect(last().initial).toEqual({ opacity: 0.4 });
    expect(last().transition).not.toEqual({ duration: 0 });
  });

  it('does NOT replay after a remount — the real bug: Home → Dashboard → Home re-faded cached cards', () => {
    render(<AnimationWrapper once="blog-b"><p>b</p></AnimationWrapper>);
    expect(last().initial).toEqual({ opacity: 0.4 }); // first visit animates
    cleanup(); // navigate away — component unmounts

    render(<AnimationWrapper once="blog-b"><p>b</p></AnimationWrapper>); // navigate back
    // initial=false tells framer to start AT the final state: no fade, no flash.
    expect(last().initial).toBe(false);
    expect(last().transition).toEqual({ duration: 0 });
    expect(last().animate).toEqual({ opacity: 1 });
  });

  it('treats each id independently — a new card still animates in', () => {
    render(<AnimationWrapper once="seen-1"><p>1</p></AnimationWrapper>);
    cleanup();
    render(<AnimationWrapper once="seen-1"><p>1</p></AnimationWrapper>); // repeat -> skipped
    expect(last().initial).toBe(false);

    render(<AnimationWrapper once="brand-new"><p>2</p></AnimationWrapper>); // fresh id -> animates
    expect(last().initial).toEqual({ opacity: 0.4 });
  });

  it('without `once`, keeps animating every mount (page-level transitions)', () => {
    render(<AnimationWrapper><p>page</p></AnimationWrapper>);
    expect(last().initial).toEqual({ opacity: 0.4 });
    cleanup();
    render(<AnimationWrapper><p>page</p></AnimationWrapper>);
    expect(last().initial).toEqual({ opacity: 0.4 }); // still animates — unchanged behaviour
  });

  it('respects a caller-supplied initial on first mount', () => {
    render(<AnimationWrapper once="custom" initial={{ opacity: 0 }}><p>c</p></AnimationWrapper>);
    expect(last().initial).toEqual({ opacity: 0 });
  });
});
