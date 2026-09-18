import type {ReactNode} from 'react';
export function AccessibilityLabel({children}:{children:ReactNode}){return <span className="sr-only">{children}</span>}
