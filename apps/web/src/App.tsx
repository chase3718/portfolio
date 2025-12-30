import { useState, useEffect } from 'react';
import { TerminalUI } from './applications/terminal/TerminalUI';
import Window from './components/window/Window';
import { KernelProvider } from './contexts';
import { KEYBIND_NEW_WINDOW, KEYBIND_CLOSE_WINDOW } from './constants';
import './App.css';
import type { ReactNode } from 'react';
import StatusBar from './components/statusBar/StatusBar';
import Toast from './components/toast/Toast';

export interface WindowItem {
	id: string;
	title: string;
	minimized?: boolean;
	maximized?: boolean;
	component: ReactNode;
}

function AppContent() {
	const [windows, setWindows] = useState<WindowItem[]>([
		{ id: crypto.randomUUID(), title: 'Terminal', component: <TerminalUI /> },
	]);
	const [focusedWindow, setFocusedWindow] = useState<string | undefined>(windows[0]?.id || undefined);
	const [showFullscreenToast, setShowFullscreenToast] = useState(false);

	// Check if fullscreen on mount
	useEffect(() => {
		const checkFullscreen = () => {
			const isFullScreenAPI = Boolean(
				document.fullscreenElement ||
					(document as any).webkitFullscreenElement ||
					(document as any).mozFullScreenElement ||
					(document as any).msFullscreenElement
			);

			// Also check window dimensions (F11 fullscreen)
			const isFullScreenWindow =
				window.innerHeight === window.screen.height && window.innerWidth === window.screen.width;

			return isFullScreenAPI || isFullScreenWindow;
		};

		// Small delay to ensure page is fully loaded
		const timer = setTimeout(() => {
			if (!checkFullscreen()) {
				setShowFullscreenToast(true);
			}
		}, 500);

		return () => clearTimeout(timer);
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Alt+Enter: Open new terminal
			if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key === KEYBIND_NEW_WINDOW.key) {
				e.preventDefault();
				e.stopPropagation();
				const newWindow: WindowItem = {
					id: crypto.randomUUID(),
					title: 'Terminal',
					component: <TerminalUI />,
				};
				setWindows((prev) => [...prev, newWindow]);
				setFocusedWindow(newWindow.id);
			}
			// Alt+Shift+Q: Close focused window
			else if (
				e.altKey &&
				e.shiftKey &&
				(e.key === KEYBIND_CLOSE_WINDOW.key || e.key === KEYBIND_CLOSE_WINDOW.key.toUpperCase())
			) {
				e.preventDefault();
				e.stopPropagation();
				if (focusedWindow !== undefined) {
					setWindows((prev) => {
						const filtered = prev.filter((w) => w.id !== focusedWindow);
						// Set focus to first remaining non-minimized window
						const nextFocus = filtered.find((w) => !w.minimized);
						setFocusedWindow(nextFocus?.id);
						return filtered;
					});
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown, { capture: true });
		return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
	}, [focusedWindow, windows]);

	const closeWindow = (id: string) => {
		setWindows((prev) => prev.filter((w) => w.id !== id));
		if (focusedWindow === id) {
			const remaining = windows.filter((w) => w.id !== id) || undefined;
			setFocusedWindow(remaining[0]?.id || undefined);
		}
	};

	const setWindowMinimized = (id: string, minimized: boolean = true) => {
		console.log('Setting window', id, 'minimized to', minimized);
		if (minimized && focusedWindow === id) {
			const remaining = windows.filter((w) => w.id !== id && !w.minimized);
			setFocusedWindow(remaining[0]?.id || undefined);
		}
		setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized } : w)));
	};

	const setWindowMaximized = (id: string, maximized: boolean = true) => {
		setWindows((prev) =>
			prev.map((w) => {
				// If maximizing this window, un-maximize all others
				if (w.id === id) {
					return { ...w, maximized };
				} else if (maximized) {
					// Un-maximize other windows when one is maximized
					return { ...w, maximized: false };
				}
				return w;
			})
		);
	};

	return (
		<>
			<div id="desktop">
				<div className="tiling-container">
					{windows.map((win) => (
						<Window
							key={win.id}
							id={win.id}
							title={win.title}
							focused={win.id === focusedWindow}
							onFocus={() => setFocusedWindow(win.id)}
							closeWindow={closeWindow}
							minimized={win.minimized}
							setWindowMinimized={setWindowMinimized}
							maximized={win.maximized}
							setWindowMaximized={setWindowMaximized}
						>
							{win.component}
						</Window>
					))}
				</div>
			</div>
			<StatusBar
				setFocusedWindow={setFocusedWindow}
				focusedWindow={focusedWindow}
				setWindowMinimized={setWindowMinimized}
				setWindowMaximized={setWindowMaximized}
				windows={windows}
			/>
			{showFullscreenToast && (
				<Toast
					message="For the best experience, press F11 to enter fullscreen mode"
					onClose={() => setShowFullscreenToast(false)}
					duration={8000}
				/>
			)}
		</>
	);
}

export default function App() {
	return (
		<KernelProvider>
			<AppContent />
		</KernelProvider>
	);
}
