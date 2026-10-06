export interface RouteMatch<T> {
  handler: T;
  params: Record<string, string>;
}

export interface RouteEntry<T> {
  handler: T;
  paramNames: string[];
}

export class RadixNode<T> {
  public segment: string;
  public isParam: boolean = false;
  public isWildcard: boolean = false;
  public handlers: Map<string, RouteEntry<T>> = new Map();
  public children: Map<string, RadixNode<T>> = new Map();
  public paramChild?: RadixNode<T>;
  public wildcardChild?: RadixNode<T>;

  constructor(segment: string = '') {
    this.segment = segment;
  }
}

export function splitPath(path: string): string[] {
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  if (!trimmed) {
    return [];
  }
  return trimmed.split(/\/+/);
}

export function mergePaths(a: string, b: string): string {
  const cleanA = a.replace(/\/+$/, '');
  const cleanB = b.replace(/^\/+/, '');
  if (!cleanA) return cleanB ? `/${cleanB}` : '/';
  if (!cleanB) return cleanA.startsWith('/') ? cleanA : `/${cleanA}`;
  const combined = `${cleanA}/${cleanB}`;
  return combined.startsWith('/') ? combined : `/${combined}`;
}

export class RadixRouter<T> {
  public root: RadixNode<T> = new RadixNode<T>();

  public insert(method: string, path: string, handler: T): void {
    const segments = splitPath(path);
    const paramNames: string[] = [];
    let current = this.root;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      if (segment.startsWith('*')) {
        paramNames.push(segment.slice(1) || 'wildcard');
        if (!current.wildcardChild) {
          const node = new RadixNode<T>(segment);
          node.isWildcard = true;
          current.wildcardChild = node;
        }
        current = current.wildcardChild;
        break;
      } else if (segment.startsWith(':')) {
        paramNames.push(segment.slice(1));
        if (!current.paramChild) {
          const node = new RadixNode<T>(segment);
          node.isParam = true;
          current.paramChild = node;
        }
        current = current.paramChild;
      } else {
        let child = current.children.get(segment);
        if (!child) {
          child = new RadixNode<T>(segment);
          current.children.set(segment, child);
        }
        current = child;
      }
    }

    current.handlers.set(method.toUpperCase(), { handler, paramNames });
  }

  public match(method: string, path: string): RouteMatch<T> | null {
    const segments = splitPath(path);
    const upperMethod = method.toUpperCase();
    return this._matchNode(this.root, segments, 0, [], upperMethod);
  }

  private _matchNode(
    node: RadixNode<T>,
    segments: string[],
    index: number,
    paramValues: string[],
    method: string
  ): RouteMatch<T> | null {
    if (index === segments.length) {
      // 1. Check exact handler on this node
      const entry = node.handlers.get(method) ?? node.handlers.get('ALL');
      if (entry) {
        return this._buildMatch(entry, paramValues);
      }

      // 2. Check if a wildcard child on this node matches empty trailing segment
      if (node.wildcardChild) {
        const wildEntry =
          node.wildcardChild.handlers.get(method) ??
          node.wildcardChild.handlers.get('ALL');
        if (wildEntry) {
          return this._buildMatch(wildEntry, [...paramValues, '']);
        }
      }

      return null;
    }

    const segment = segments[index];

    // Priority 1: Exact match child
    const exactChild = node.children.get(segment);
    if (exactChild) {
      const res = this._matchNode(
        exactChild,
        segments,
        index + 1,
        paramValues,
        method
      );
      if (res) return res;
    }

    // Priority 2: Param child
    if (node.paramChild) {
      const res = this._matchNode(
        node.paramChild,
        segments,
        index + 1,
        [...paramValues, segment],
        method
      );
      if (res) return res;
    }

    // Priority 3: Wildcard child
    if (node.wildcardChild) {
      const wildEntry =
        node.wildcardChild.handlers.get(method) ??
        node.wildcardChild.handlers.get('ALL');
      if (wildEntry) {
        const remainder = segments.slice(index).join('/');
        return this._buildMatch(wildEntry, [...paramValues, remainder]);
      }
    }

    return null;
  }

  private _buildMatch(entry: RouteEntry<T>, paramValues: string[]): RouteMatch<T> {
    const params: Record<string, string> = {};
    for (let i = 0; i < entry.paramNames.length; i++) {
      params[entry.paramNames[i]] = paramValues[i] ?? '';
    }
    return {
      handler: entry.handler,
      params,
    };
  }
}
