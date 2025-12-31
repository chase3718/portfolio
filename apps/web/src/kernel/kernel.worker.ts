/// <reference lib="webworker" />

import type { KernelRequest, KernelResponse } from './protocol';
import { installIdbGlobals } from './idbDriver';
import { defaultAppConfig } from '../config/appConfig';
import { defaultThemeCss } from '../theme/defaultTheme';

const FS_KEY = defaultAppConfig.idb.fsStateKey;

interface KernelAPI {
	hello(name: string): string;
	fs_init_from_bytes(bytes: Uint8Array | undefined): void;
	fs_dump_state(): Uint8Array;
	fs_mkdir(path: string): void;
	fs_read_file(path: string): Uint8Array;
	fs_readdir(path: string): Array<string>;
	fs_write_file(path: string, data: Uint8Array): void;
	fs_stat(path: string): { is_dir: boolean; is_file: boolean; size: number };
	fs_rm(path: string): void;
	fs_rmdir(path: string): void;
	fs_mv(from: string, to: string): void;
	fs_cp(from: string, to: string): void;
}

interface IdbGlobal {
	__idb_get_bytes?(key: string): Promise<Uint8Array | undefined>;
	__idb_set_bytes?(key: string, bytes: Uint8Array): Promise<void>;
}

async function idbGetBytes(key: string): Promise<Uint8Array | undefined> {
	return (globalThis as unknown as IdbGlobal).__idb_get_bytes?.(key);
}

async function idbSetBytes(key: string, bytes: Uint8Array): Promise<void> {
	return (globalThis as unknown as IdbGlobal).__idb_set_bytes?.(key, bytes);
}

installIdbGlobals();

let api: KernelAPI | null = null;

(async () => {
	try {
		console.log('[kernel] Starting initialization...');

		const kernelModule = await import('kernel');
		console.log('[kernel] Kernel module imported');

		// Initialize WASM (required for --target web)
		if (typeof kernelModule.default === 'function') {
			await kernelModule.default();
			console.log('[kernel] WASM initialized');
		}

		api = kernelModule as unknown as KernelAPI;

		console.log('[kernel] Loading persisted state...');
		const persisted = await idbGetBytes(FS_KEY);
		api.fs_init_from_bytes(persisted ?? undefined);

		if (!persisted) {
			console.log('[kernel] No existing filesystem found, creating base structure...');
			try {
				const baseDirs = ['/home', '/bin', '/etc', '/tmp', '/var', '/usr', '/usr/local', '/opt', '/dev', '/apps'];

				for (const dir of baseDirs) {
					api.fs_mkdir(dir);
				}

				const appDirs = ['/apps/terminal', '/apps/textviewer', '/apps/filebrowser', '/apps/notes', '/apps/editor'];
				for (const dir of appDirs) {
					api.fs_mkdir(dir);
				}

				const encoder = new TextEncoder();
				const configText = JSON.stringify(defaultAppConfig, null, 2);
				api.fs_write_file('/etc/app-config.json', encoder.encode(configText));
				api.fs_write_file('/etc/theme.css', encoder.encode(defaultThemeCss));

				const welcomeText = [
					'=============================================================',
					'                    Welcome to ChaseOS!',
					'=============================================================',
					'',
					'ChaseOS is a browser-based Unix-like operating system built with',
					'React, TypeScript, and WebAssembly (Rust). It provides a fully',
					'functional terminal environment with persistent file storage.',
					'',
					'PROJECT OVERVIEW:',
					'',
					'This is a portfolio project showcasing:',
					'  • React 19 with functional components and hooks',
					'  • TypeScript for type safety and developer experience',
					'  • WebAssembly (Rust) kernel for filesystem operations',
					'  • Web Workers for background processing',
					'  • IndexedDB for persistent data storage',
					'  • CSS animations and transitions for UI polish',
					'  • Responsive window management system',
					'  • Modular architecture with hooks, services, and utilities',
					'',
					'WHY I MADE THIS:',
					'',
					'I created ChaseOS as an expression of my passion for personal computing,',
					'Linux, and the open-source philosophy. I believe deeply in the importance',
					'of users having complete control over their computing systems and tools.',
					'',
					'In an era of cloud services and proprietary software, I wanted to build',
					'something that demonstrates:',
					'',
					'  • User Autonomy: Full control over your data and system behavior',
					'  • Privacy-First Design: All computation happens locally in your browser',
					'  • No Tracking: Zero dependencies on remote services or analytics',
					'  • Open Philosophy: Designed with transparency and extensibility in mind',
					'  • Linux Inspiration: Bringing Unix philosophy to the browser',
					'',
					'ChaseOS runs entirely in your browser with no server communication,',
					'keeping your data private and your computing experience under your control.',
					'',
					'ON ARTIFICIAL INTELLIGENCE:',
					'',
					'I view AI as another tool in the developer toolkit—powerful, useful, and',
					"worth learning to use well. However, I recognize we're in an AI bubble, and",
					"I'm cautious about its limitations and hype.",
					'',
					'My philosophy:',
					'',
					'  • AI as Tool, Not Replacement: I use it to accelerate fit and polish,',
					'    not to replace my ability to code or think critically',
					'  • I Still Own My Work: Every line of code I write is my responsibility',
					"    and contribution. I understand what I'm building.",
					'  • Skeptical Thinking: The AI bubble will deflate. I invest in timeless',
					'    fundamentals: algorithms, architecture, and first principles.',
					'  • Strategic Use: AI excels at boilerplate, refactoring, documentation,',
					'    and finding bugs—areas where speed matters more than novelty.',
					'  • Never Let It Atrophy My Skills: I refuse to outsource my ability to',
					'    solve problems, design systems, or understand code deeply.',
					'',
					'I built ChaseOS with my own hands, and while I used AI for assistance with',
					'certain tasks, the core architecture, design decisions, and problem-solving',
					'are entirely my own. This is the approach I take to all my work.',
					'',
					'(Note, I did utilize AI tools to help generate the initial welcome text you',
					'are reading now, and to proofread and suggest improvements to certain sections.)',
					'',
					'FEATURES:',
					'',
					'Terminal:',
					'  • 19 built-in commands (help, ls, cd, cat, mkdir, open, edit, etc.)',
					'  • Tab completion for commands and file paths',
					'  • Command history navigation (arrow keys)',
					'  • Real-time filesystem operations',
					'  • Tree view for directory exploration',
					'',
					'Filesystem:',
					'  • Full filesystem hierarchy under /home, /bin, /etc, /opt, etc.',
					'  • Persistent storage using IndexedDB',
					'  • File and directory operations (create, read, delete, move, copy)',
					'  • Directory traversal and stat information',
					'',
					'User Interface:',
					'  • Multi-window tiling desktop environment',
					'  • Automatic window tiling (1-4+ windows)',
					'  • Window maximize/minimize functionality',
					'  • Status bar with window switching and app launcher',
					'  • Application launcher (☰ Apps button)',
					'  • Smooth animations on all interactions',
					'  • Text file viewer and editor applications',
					'  • Fully customizable theme via /etc/theme.css',
					'',
					'Theme Customization:',
					'  • All styles stored in /etc/theme.css',
					'  • CSS variables for easy customization',
					'  • Edit colors, spacing, fonts, transitions, and more',
					'  • Changes apply immediately without restart',
					'  • Edit with: edit /etc/theme.css',
					'',
					'GETTING STARTED:',
					'',
					'1. Type "help" to see all available commands',
					'2. Use "ls" or "tree" to explore the filesystem',
					'3. Try "cat /home/welcome.txt" to read this file',
					'4. Use "open <filename>" to view files in the text viewer',
					'5. Use "edit <filename>" to edit files',
					'6. Click ☰ Apps in the status bar to launch applications',
					'7. Customize the theme by editing /etc/theme.css',
					'',
					'COMMAND EXAMPLES:',
					'',
					'  pwd                    # Show current directory',
					'  cd /home               # Change directory',
					'  ls                     # List directory contents',
					'  tree /home             # Show directory tree',
					'  mkdir projects         # Create a new directory',
					'  cat /home/welcome.txt  # Read this file',
					'  echo "Hello" > file.txt # Create a file',
					'  stat /home             # Show file information',
					'  open /home/welcome.txt # View file in text viewer',
					'  edit /etc/theme.css    # Edit the theme',
					'  cp file.txt backup.txt # Copy a file',
					'  mv old.txt new.txt     # Rename a file',
					'  rm file.txt            # Delete a file',
					'',
					'AVAILABLE APPLICATIONS:',
					'',
					'  💻 Terminal    - Unix-like shell with 19 commands',
					'  📝 Text Editor - Edit files with save functionality',
					'  📄 Text Viewer - View files in read-only mode',
					'',
					'Launch apps via:',
					'  • Click ☰ Apps button in status bar',
					'  • Use "open <file>" for text viewer',
					'  • Use "edit <file>" for text editor',
					'',
					'PERSISTENCE:',
					'',
					'All files and directories you create are automatically saved to',
					"your browser's IndexedDB. Your data persists across browser",
					'sessions. To reset everything, type:',
					'',
					'  sudo reset --confirm',
					'',
					'DATA & PRIVACY:',
					'',
					'• All data is stored locally in your browser (IndexedDB)',
					'• No data is sent to any server',
					'• Data is cleared when you clear your browser cache',
					'• Use "sudo reset --confirm" to manually clear all data',
					'',
					'ARCHITECTURE:',
					'',
					'Frontend: React 19 + TypeScript with Vite',
					'  - App.tsx: Main application and window management',
					'  - hooks/: useWindowManager, useGlobalKeyboard, useFullscreenCheck',
					'  - services/: ApplicationFactory, ApplicationRegistry',
					'  - components/: Window, StatusBar, Terminal, TextEditor, TextViewer',
					'  - theme/: defaultTheme.ts (CSS variables), applyFsTheme.ts',
					'',
					'Backend: Rust compiled to WebAssembly',
					'  - kernel.worker.ts: Web Worker running WASM kernel',
					'  - kernelClient.ts: RPC interface to WASM backend',
					'  - vfs.rs: Virtual filesystem implementation in Rust',
					'',
					'Storage: Browser IndexedDB',
					'  - idbDriver.ts: Abstraction layer for IndexedDB operations',
					'  - Automatic persistence after each filesystem operation',
					'',
					'Key Design Patterns:',
					'  - Modular architecture with clear separation of concerns',
					'  - Custom hooks for reusable stateful logic',
					'  - Factory pattern for application creation',
					'  - Registry pattern for application management',
					'  - CSS variables for themeable design system',
					'',
					'=============================================================',
					'',
					'Enjoy exploring ChaseOS!',
				].join('\n');
				api.fs_write_file('/home/welcome.txt', encoder.encode(welcomeText));

				const terminalInfo = [
					'Terminal Application',
					'',
					'A Unix-like shell with support for:',
					'- File operations (mkdir, rm, cp, mv)',
					'- Text processing (cat, echo)',
					'- Directory navigation (cd, ls, pwd)',
					'- File inspection (stat, tree)',
					'- Filesystem reset (sudo reset --confirm)',
				].join('\n');
				api.fs_write_file('/apps/terminal/README.txt', encoder.encode(terminalInfo));

				const textviewerInfo = [
					'Text Viewer Application',
					'',
					'View and read text files from the filesystem.',
					'Usage: open <filepath>',
					'',
					'Supports any text file in the system.',
				].join('\n');
				api.fs_write_file('/apps/textviewer/README.txt', encoder.encode(textviewerInfo));

				const filebrowserInfo = [
					'File Browser Application',
					'',
					'Navigate and explore the filesystem visually.',
					'Features:',
					'- Directory tree navigation',
					'- File preview',
					'- Quick access to common directories',
				].join('\n');
				api.fs_write_file('/apps/filebrowser/README.txt', encoder.encode(filebrowserInfo));

				const notesInfo = [
					'Notes Application',
					'',
					'Simple note-taking application.',
					'Create and manage text notes across sessions.',
					'Notes are stored in /home/notes/',
				].join('\n');
				api.fs_write_file('/apps/notes/README.txt', encoder.encode(notesInfo));

				const editorInfo = [
					'Text Editor Application',
					'',
					'Create and edit text files directly in the browser.',
					'Usage: edit <filepath>',
					'Files are saved back to the virtual filesystem.',
				].join('\n');
				api.fs_write_file('/apps/editor/README.txt', encoder.encode(editorInfo));
				const resumeText = [
					'Chase Williams',
					'Bristol Township, PA',
					'chase.williams@chasehw.com',
					'',
					'',
					'SUMMARY',
					'',
					'Full Stack Software Engineer with 5+ years of experience delivering enterprise-scale web applications in regulated environments. Proven track record of driving cost savings, accelerating delivery timelines, and collaborating with senior business stakeholders. Strong background in BPM platforms, UI/UX optimization, and end-to-end application lifecycle ownership.',
					'',
					'',
					'WORK EXPERIENCE',
					'',
					'Bristol Myers Squibb — Princeton, NJ',
					'Full Stack Software Engineer II | Dec 2022 – Present',
					'',
					'• Played a key role in delivering a mission-critical BPM platform initiative, generating approximately $500K in annual cost savings.',
					'',
					'• Partnered directly with senior leadership and VP-level stakeholders to translate business requirements into scalable technical solutions, achieving delivery in under six months.',
					'',
					'• Collaborated closely with UI/UX designers to implement interface improvements, resulting in a 30% increase in development throughput and user effectiveness.',
					'',
					'• Led requirements analysis, architectural design discussions, and implementation across multiple R&ED IT initiatives, ensuring high-quality, compliant solutions.',
					'',
					'• Mentored a software engineering intern on an internal mobile application, guiding design decisions and ensuring successful on-time delivery.',
					'',
					'• Contributed across all phases of the BPM application software development lifecycle, including planning, development, testing, deployment, and maintenance.',
					'',
					'• Participated in process reviews, platform architecture planning, and long-term BPM roadmap strategy.',
					'',
					'',
					'Evoke Technologies — Dayton, OH',
					'Full Stack Software Engineer | Aug 2019 – Dec 2022',
					'',
					'• Served as a consultant across up to four concurrent client teams, contributing to design discussions, implementation strategy, and delivery planning.',
					'',
					'• Developed and maintained high-quality, production-grade code across full-stack systems, emphasizing reliability, maintainability, and performance.',
					'',
					'• Designed and executed comprehensive test strategies, supporting 99.99% application uptime in production environments.',
					'',
					'• Collaborated directly with end users and stakeholders to gather feedback, refine requirements, and rapidly address development requests.',
					'',
					'• Supported iterative delivery in Agile environments, consistently meeting project milestones and client expectations.',
					'',
					'',
					'POWERsonic Industries — Sharonville, OH',
					'Cable Harness Assembler | Oct 2018 – Apr 2019',
					'',
					'• Interpreted electrical schematics, blueprints, and work orders to accurately assemble complex cable harnesses.',
					'',
					'• Positioned, aligned, and installed electrical components according to specifications and quality standards.',
					'',
					'• Collaborated with engineers and supervisors to plan work activities and resolve production issues.',
					'',
					'• Inspected and tested assemblies for electrical integrity and compliance, documenting results and corrective actions.',
					'',
					'',
					'CERTIFICATIONS',
					'',
					'Full Stack Software Development Certificate — July 2019',
					'MAX Technical Training, Mason, OH',
					'',
					'',
					'TECHNICAL SKILLS',
					'',
					'Languages: Java, JavaScript, TypeScript, Rust, C#, C++, HTML, CSS',
					'Frameworks & Libraries: React, Angular, Next.js, Node.js, Express',
					'Cloud & Databases: AWS, SQL, MongoDB, IndexedDB',
					'Tools & Platforms: Git, SVN, Linux, Webpack, Vite, WebAssembly',
					'Methodologies: Agile / Scrum',
				].join('\n');
				api.fs_write_file('/home/resume.txt', encoder.encode(resumeText));
				await persist();
				console.log('[kernel] Filesystem initialized');
			} catch (err) {
				console.error('[kernel] Failed to create base filesystem:', err);
			}
		}

		try {
			api.fs_stat('/etc/app-config.json');
		} catch {
			const encoder = new TextEncoder();
			const configText = JSON.stringify(defaultAppConfig, null, 2);
			api.fs_write_file('/etc/app-config.json', encoder.encode(configText));
			await persist();
			console.log('[kernel] Added missing app-config.json');
		}

		try {
			api.fs_stat('/etc/theme.css');
		} catch {
			const encoder = new TextEncoder();
			api.fs_write_file('/etc/theme.css', encoder.encode(defaultThemeCss));
			await persist();
			console.log('[kernel] Added missing theme.css');
		}

		try {
			api.fs_stat('/apps/editor');
		} catch {
			api.fs_mkdir('/apps/editor');
			const encoder = new TextEncoder();
			const editorInfo = [
				'Text Editor Application',
				'',
				'Create and edit text files directly in the browser.',
				'Usage: edit <filepath>',
				'Files are saved back to the virtual filesystem.',
			].join('\n');
			api.fs_write_file('/apps/editor/README.txt', encoder.encode(editorInfo));
			await persist();
			console.log('[kernel] Added missing /apps/editor');
		}

		console.log('[kernel] Filesystem initialized');

		self.postMessage({ type: 'ready' });
		console.log('[kernel] Ready');
	} catch (err) {
		console.error('[kernel] Initialization failed:', err);
		const e = err instanceof Error ? err : new Error(String(err));
		self.postMessage({ type: 'fatal', error: { message: e.message, stack: e.stack } });
	}
})();

async function persist() {
	if (!api) throw new Error('Kernel not initialized');
	const bytes: Uint8Array = api.fs_dump_state();
	await idbSetBytes(FS_KEY, bytes);
}

self.onmessage = async (ev: MessageEvent<KernelRequest>) => {
	const req = ev.data;

	if (!req || !req.id || !req.type) {
		return; // Invalid request
	}

	try {
		if (!api) {
			throw new Error('Kernel not initialized');
		}

		let result: unknown;
		let needsPersist = false;

		switch (req.type) {
			case 'hello':
				result = api.hello(req.name);
				break;

			case 'fs_mkdir':
				api.fs_mkdir(req.path);
				needsPersist = true;
				break;

			case 'fs_readdir':
				result = api.fs_readdir(req.path);
				break;

			case 'fs_write_file':
				api.fs_write_file(req.path, req.data);
				needsPersist = true;
				break;

			case 'fs_read_file':
				result = api.fs_read_file(req.path);
				break;

			case 'fs_stat':
				result = api.fs_stat(req.path);
				break;

			case 'fs_rm':
				api.fs_rm(req.path);
				needsPersist = true;
				break;

			case 'fs_rmdir':
				api.fs_rmdir(req.path);
				needsPersist = true;
				break;

			case 'fs_mv':
				api.fs_mv(req.from, req.to);
				needsPersist = true;
				break;

			case 'fs_cp':
				api.fs_cp(req.from, req.to);
				needsPersist = true;
				break;

			default: {
				const exhaustiveCheck: never = req;
				throw new Error(`Unknown request type: ${JSON.stringify(exhaustiveCheck)}`);
			}
		}

		// Persist filesystem state after mutating operations
		if (needsPersist) {
			await persist();
		}

		const response: KernelResponse = {
			id: req.id,
			ok: true,
			result,
		};
		self.postMessage(response);
	} catch (err) {
		const e = err instanceof Error ? err : new Error(String(err));
		const response: KernelResponse = {
			id: req.id,
			ok: false,
			error: {
				message: e.message,
				stack: e.stack,
			},
		};
		self.postMessage(response);
	}
};
