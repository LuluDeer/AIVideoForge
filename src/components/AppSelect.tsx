import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type SelectValue = string | number;

export type AppSelectOption = {
  value: SelectValue;
  label: ReactNode;
  disabled?: boolean;
};

export type AppSelectChangeEvent = {
  target: {
    value: string;
    name?: string;
  };
  currentTarget: {
    value: string;
    name?: string;
  };
};

type AppSelectProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onChange' | 'defaultValue'> & {
  value?: SelectValue;
  defaultValue?: SelectValue;
  options?: AppSelectOption[];
  onChange?: (event: AppSelectChangeEvent) => void;
  placeholder?: ReactNode;
  className?: string;
  disabled?: boolean;
  children?: ReactNode;
  name?: string;
};

const flattenOptionChildren = (children: ReactNode): AppSelectOption[] => {
  const collected: AppSelectOption[] = [];

  const visit = (nodes: ReactNode) => {
    const list = Array.isArray(nodes) ? nodes : [nodes];
    list.forEach((node) => {
      if (Array.isArray(node)) {
        visit(node);
        return;
      }

      if (!node || typeof node !== 'object' || !('props' in node)) {
        return;
      }

      const element = node as { props?: { value?: SelectValue; disabled?: boolean; children?: ReactNode } };
      const props = element.props;
      if (!props) return;

      const label = props.children;
      const rawValue = props.value ?? (typeof label === 'string' || typeof label === 'number' ? label : '');
      collected.push({ value: rawValue, label, disabled: props.disabled });
    });
  };

  visit(children);
  return collected;
};

export default function AppSelect({
  value,
  defaultValue,
  options,
  onChange,
  placeholder = '请选择',
  className = '',
  disabled = false,
  children,
  name,
  ...rest
}: AppSelectProps) {
  const childOptions = useMemo(() => flattenOptionChildren(children), [children]);
  const normalizedOptions = options ?? childOptions;
  const [open, setOpen] = useState(false);
  const [innerValue, setInnerValue] = useState<SelectValue | undefined>(defaultValue);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedValue = value ?? innerValue;
  const selectedOption = normalizedOptions.find(option => String(option.value) === String(selectedValue));
  const displayLabel = selectedOption?.label ?? placeholder;

  const updateMenuPosition = () => {
    const root = rootRef.current;
    if (!root) return;

    const rect = root.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const gap = 4;
    const margin = 12;
    const spaceBelow = viewportHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openAbove = spaceBelow < 160 && spaceAbove > spaceBelow;
    const availableHeight = Math.max(120, Math.min(256, openAbove ? spaceAbove - gap : spaceBelow - gap));
    const width = Math.max(rect.width, 160);
    const left = Math.min(Math.max(rect.left, margin), Math.max(margin, viewportWidth - width - margin));

    setMenuStyle({
      left,
      width,
      maxHeight: availableHeight,
      ...(openAbove
        ? { bottom: viewportHeight - rect.top + gap, top: 'auto' }
        : { top: rect.bottom + gap, bottom: 'auto' }),
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open, normalizedOptions.length]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    window.visualViewport?.addEventListener('resize', updateMenuPosition);
    window.visualViewport?.addEventListener('scroll', updateMenuPosition);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
      window.visualViewport?.removeEventListener('resize', updateMenuPosition);
      window.visualViewport?.removeEventListener('scroll', updateMenuPosition);
    };
  }, [open]);

  const emitChange = (nextValue: SelectValue) => {
    if (value === undefined) {
      setInnerValue(nextValue);
    }

    const stringValue = String(nextValue);
    onChange?.({
      target: { value: stringValue, name },
      currentTarget: { value: stringValue, name },
    });
    setOpen(false);
  };

  const menu = open && !disabled ? (
    <div ref={menuRef} className="app-select__menu app-select__menu--portal" role="listbox" style={menuStyle}>
      {normalizedOptions.length > 0 ? normalizedOptions.map(option => {
        const isSelected = String(option.value) === String(selectedValue);
        return (
          <button
            type="button"
            key={String(option.value)}
            className={`app-select__option ${isSelected ? 'app-select__option--selected' : ''}`.trim()}
            role="option"
            aria-selected={isSelected}
            disabled={option.disabled}
            onClick={() => emitChange(option.value)}
          >
            {option.label}
          </button>
        );
      }) : <div className="app-select__empty">暂无选项</div>}
    </div>
  ) : null;

  return (
    <div
      {...rest}
      ref={rootRef}
      className={`app-select ${open ? 'app-select--open' : ''} ${disabled ? 'app-select--disabled' : ''} ${className}`.trim()}
    >
      <button
        type="button"
        className="app-select__button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(next => !next)}
      >
        <span className={`app-select__value ${selectedOption ? '' : 'app-select__value--placeholder'}`.trim()}>{displayLabel}</span>
        <span className="app-select__chevron" aria-hidden="true">▾</span>
      </button>

      {menu && typeof document !== 'undefined' ? createPortal(menu, document.body) : null}
    </div>
  );
}
