# React Hooks Deep Dive: From Fundamentals to Advanced Patterns

## The Hooks Revolution

React Hooks, introduced in React 16.8, fundamentally changed how developers write React components. By enabling state and lifecycle features in function components, Hooks eliminated the need for class components in most cases and opened the door to more composable, reusable logic.

## Core Hooks

### useState
The most fundamental hook for managing local component state:

```jsx
import { useState } from 'react';

function Counter() {
    const [count, setCount] = useState(0);

    return (
        <div>
            <p>Count: {count}</p>
            <button onClick={() => setCount(c => c + 1)}>Increment</button>
        </div>
    );
}
```

Key details:
- The initial value is only used on the first render
- State updates trigger a re-render
- Use the functional updater form (`setCount(c => c + 1)`) when the new state depends on the previous state
- State updates are batched in React 18+ (automatic batching)

### useEffect
The hook for side effects — data fetching, subscriptions, DOM manipulation, and timers:

```jsx
import { useEffect, useState } from 'react';

function UserProfile({ userId }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function fetchUser() {
            setLoading(true);
            const response = await fetch(`/api/users/${userId}`);
            const data = await response.json();
            if (!cancelled) {
                setUser(data);
                setLoading(false);
            }
        }

        fetchUser();

        // Cleanup function: runs on unmount and before re-execution
        return () => { cancelled = true; };
    }, [userId]); // Dependency array: only re-run when userId changes

    if (loading) return <Spinner />;
    return <ProfileCard user={user} />;
}
```

The dependency array controls when the effect runs:
- No array: Runs after every render
- Empty array `[]`: Runs once on mount
- Array with values `[userId]`: Runs when any value changes

### useRef
For mutable values that persist across renders without triggering re-renders:

```jsx
import { useRef, useEffect } from 'react';

function Timer() {
    const intervalRef = useRef(null);
    const renderCount = useRef(0);

    useEffect(() => {
        intervalRef.current = setInterval(() => {
            console.log('Tick');
        }, 1000);

        return () => clearInterval(intervalRef.current);
    }, []);

    renderCount.current++;
    return <div>Renders: {renderCount.current}</div>;
}
```

### useMemo and useCallback
Performance optimization hooks that memoize values and functions:

```jsx
import { useMemo, useCallback } from 'react';

function ProductList({ products, category, onSelect }) {
    // Memoize expensive computation
    const filteredProducts = useMemo(() => {
        return products.filter(p => p.category === category)
                       .sort((a, b) => b.rating - a.rating);
    }, [products, category]);

    // Memoize callback to prevent unnecessary child re-renders
    const handleSelect = useCallback((product) => {
        onSelect(product.id);
    }, [onSelect]);

    return (
        <ul>
            {filteredProducts.map(product => (
                <ProductItem
                    key={product.id}
                    product={product}
                    onSelect={handleSelect}
                />
            ))}
        </ul>
    );
}
```

## Advanced Hooks

### useReducer
For complex state logic with multiple sub-values:

```jsx
import { useReducer } from 'react';

const initialState = { items: [], loading: false, error: null };

function reducer(state, action) {
    switch (action.type) {
        case 'FETCH_START':
            return { ...state, loading: true, error: null };
        case 'FETCH_SUCCESS':
            return { items: action.payload, loading: false, error: null };
        case 'FETCH_ERROR':
            return { ...state, loading: false, error: action.payload };
        case 'ADD_ITEM':
            return { ...state, items: [...state.items, action.payload] };
        case 'REMOVE_ITEM':
            return {
                ...state,
                items: state.items.filter(i => i.id !== action.payload)
            };
        default:
            return state;
    }
}

function ShoppingCart() {
    const [state, dispatch] = useReducer(reducer, initialState);

    const fetchItems = async () => {
        dispatch({ type: 'FETCH_START' });
        try {
            const res = await fetch('/api/cart');
            dispatch({ type: 'FETCH_SUCCESS', payload: await res.json() });
        } catch (err) {
            dispatch({ type: 'FETCH_ERROR', payload: err.message });
        }
    };

    // ...
}
```

### useContext
For sharing state across the component tree without prop drilling:

```jsx
import { createContext, useContext, useState } from 'react';

const ThemeContext = createContext('light');

function App() {
    const [theme, setTheme] = useState('dark');
    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            <Layout />
        </ThemeContext.Provider>
    );
}

function ThemedButton() {
    const { theme, setTheme } = useContext(ThemeContext);
    return (
        <button
            className={`btn btn-${theme}`}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
            Toggle Theme
        </button>
    );
}
```

## Custom Hooks

Custom hooks are the key to extracting and reusing stateful logic:

### useDebounce
```jsx
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}

// Usage: Search with debounce
function SearchBar() {
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebounce(query, 300);

    useEffect(() => {
        if (debouncedQuery) searchAPI(debouncedQuery);
    }, [debouncedQuery]);

    return <input value={query} onChange={e => setQuery(e.target.value)} />;
}
```

### useLocalStorage
```jsx
function useLocalStorage(key, initialValue) {
    const [value, setValue] = useState(() => {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : initialValue;
    });

    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);

    return [value, setValue];
}
```

### useFetch
```jsx
function useFetch(url, options = {}) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();

        async function fetchData() {
            try {
                setLoading(true);
                const res = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                setData(await res.json());
            } catch (err) {
                if (err.name !== 'AbortError') setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
        return () => controller.abort();
    }, [url]);

    return { data, error, loading };
}
```

## Rules of Hooks

1. Only call hooks at the top level of your component (not inside loops, conditions, or nested functions)
2. Only call hooks from React function components or custom hooks
3. The ESLint plugin `eslint-plugin-react-hooks` enforces these rules automatically
4. Always specify all dependencies in useEffect, useMemo, and useCallback dependency arrays
