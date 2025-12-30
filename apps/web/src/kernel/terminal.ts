import type { KernelClient } from './kernelClient';
import { clearDatabase } from './idbDriver';
import { defaultAppConfig } from '../config/appConfig';

export type TerminalResult = {
	stdout: string;
	stderr: string;
	code: number;
};

export type TerminalOptions = {
	cwd?: string;
	prompt?: string;
	clearScreenCode?: string;
};

type CommandHandler = (args: string[]) => Promise<TerminalResult>;

export class Terminal {
	private kernel: KernelClient;
	private cwd: string;
	private promptStr: string;
	private clearScreenCode: string;
	private handlers: Map<string, CommandHandler> = new Map();
	private history: string[] = [];

	constructor(kernel: KernelClient, opts: TerminalOptions = {}) {
		this.kernel = kernel;
		this.cwd = normalizePath(opts.cwd ?? defaultAppConfig.filesystem.rootPath);
		this.promptStr = opts.prompt ?? defaultAppConfig.terminal.promptDefault;
		this.clearScreenCode = opts.clearScreenCode ?? defaultAppConfig.terminal.clearScreenCode;
		this.registerBuiltins();
	}

	get prompt(): string {
		return `${this.promptStr}:${this.cwd}$`;
	}

	getCwd(): string {
		return this.cwd;
	}

	getHistory(): readonly string[] {
		return this.history;
	}

	async exec(line: string): Promise<TerminalResult> {
		const trimmed = line.trim();
		if (!trimmed) return ok('');

		this.history.push(trimmed);

		const tokens = tokenize(trimmed);
		if (tokens.length === 0) return ok('');

		const cmd = tokens[0];
		const args = tokens.slice(1);

		const handler = this.handlers.get(cmd);
		if (!handler) return fail(`command not found: ${cmd}`);

		try {
			return await handler(args);
		} catch (e) {
			const err = e instanceof Error ? e : new Error(String(e));
			return fail(err.message);
		}
	}

	private registerBuiltins() {
		this.handlers.set('help', async () => {
			return ok(
				[
					'Commands:',
					'  help                   - Show this help message',
					'  clear                  - Clear the terminal',
					'  hello <name>           - Greet someone',
					'  pwd                    - Print working directory',
					'  cd <path>              - Change directory',
					'  ls [path]              - List directory contents',
					'  tree [path]            - Display directory tree',
					'  mkdir <path>           - Create a directory',
					'  cat <file>             - Display file contents',
					'  open <file>            - Open file in text viewer',
					'  edit <file>            - Edit file in text editor',
					'  echo <text> > <file>   - Write text to file',
					'  rm <file>              - Remove a file',
					'  rmdir <dir>            - Remove an empty directory',
					'  mv <from> <to>         - Move/rename file or directory',
					'  cp <from> <to>         - Copy a file',
					'  stat <path>            - Show file/directory information',
					'  reset                  - Clear terminal (same as clear)',
					'  sudo reset --confirm   - Clear filesystem and reload',
					'',
					'Examples:',
					'  mkdir /docs',
					'  echo "Hello World" > /docs/hello.txt',
					'  cat /docs/hello.txt',
					'  tree /docs',
				].join('\n')
			);
		});

		this.handlers.set('clear', async () => {
			return ok(this.clearScreenCode);
		});

		this.handlers.set('reset', async () => {
			return fail('Permission denied. Use "sudo reset" to reset the filesystem.');
		});

		this.handlers.set('sudo', async (args) => {
			if (args.length === 0) {
				return fail('usage: sudo <command> [args...]');
			}

			const subCommand = args[0];

			if (subCommand === 'reset') {
				const hasConfirm = args.includes('--confirm');

				if (!hasConfirm) {
					return fail(
						[
							'WARNING: This will permanently delete all files and directories!',
							'',
							'If you are sure, type: sudo reset --confirm',
						].join('\n')
					);
				}

				// Confirmed - proceed with reset
				try {
					await clearDatabase();
					// Reload the page to reinitialize with fresh filesystem
					window.location.reload();
					return ok('Resetting filesystem...');
				} catch (err) {
					const e = err instanceof Error ? err : new Error(String(err));
					return fail(`Failed to reset: ${e.message}`);
				}
			}

			return fail(`sudo: ${subCommand}: command not found`);
		});

		this.handlers.set('hello', async (args) => {
			const name = args.join(' ') || 'world';
			const res = await this.kernel.hello(name);
			return ok(res);
		});

		this.handlers.set('pwd', async () => ok(this.cwd));

		this.handlers.set('open', async (args) => {
			if (args.length === 0) {
				return fail('usage: open <file>');
			}

			const filePath = normalizePath(resolvePath(this.cwd, args[0]));

			try {
				const stat = await this.kernel.fs_stat(filePath);
				if (stat.is_dir) {
					return fail(`${filePath} is a directory, not a file`);
				}

				(window as Window & { openFile?: (path: string) => void }).openFile?.(filePath);
				return ok(`Opening ${filePath}...`);
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				return fail(`cannot open '${filePath}': ${e.message}`);
			}
		});

		this.handlers.set('edit', async (args) => {
			if (args.length === 0) {
				return fail('usage: edit <file>');
			}

			const filePath = normalizePath(resolvePath(this.cwd, args[0]));

			try {
				const stat = await this.kernel.fs_stat(filePath);
				if (stat.is_dir) {
					return fail(`${filePath} is a directory, not a file`);
				}
			} catch {
				// Create the file if it does not exist
				const encoder = new TextEncoder();
				await this.kernel.fs_write_file(filePath, encoder.encode(''));
			}

			(window as Window & { openEditor?: (path: string) => void }).openEditor?.(filePath);
			return ok(`Editing ${filePath}...`);
		});

		this.handlers.set('cd', async (args) => {
			const target = args[0] ?? '/';
			const newPath = normalizePath(resolvePath(this.cwd, target));

			// Validate directory exists
			try {
				const stat = await this.kernel.fs_stat(newPath);
				if (!stat.is_dir) {
					return fail(`not a directory: ${newPath}`);
				}
				this.cwd = newPath;
				return ok('');
			} catch {
				return fail(`directory not found: ${newPath}`);
			}
		});

		this.handlers.set('ls', async (args) => {
			const target = args[0] ? normalizePath(resolvePath(this.cwd, args[0])) : this.cwd;

			try {
				const entries = await this.kernel.fs_readdir(target);
				if (entries.length === 0) {
					return ok('');
				}
				return ok(entries.join('\n'));
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				return fail(e.message);
			}
		});

		this.handlers.set('tree', async (args) => {
			const target = args[0] ? normalizePath(resolvePath(this.cwd, args[0])) : this.cwd;

			try {
				const tree = await this.buildTree(target, '', true);
				return ok(tree);
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				return fail(e.message);
			}
		});

		this.handlers.set('mkdir', async (args) => {
			if (args.length === 0) {
				return fail('usage: mkdir <path>');
			}

			const path = normalizePath(resolvePath(this.cwd, args[0]));

			try {
				await this.kernel.fs_mkdir(path);
				return ok('');
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				return fail(e.message);
			}
		});

		this.handlers.set('cat', async (args) => {
			if (args.length === 0) {
				return fail('usage: cat <file>');
			}

			const path = normalizePath(resolvePath(this.cwd, args[0]));

			try {
				const data = await this.kernel.fs_read_file(path);
				const text = new TextDecoder().decode(data);
				return ok(text);
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				return fail(e.message);
			}
		});

		this.handlers.set('echo', async (args) => {
			const redirectIndex = args.indexOf('>');

			// if (redirectIndex === -1) {
			// }

			if (redirectIndex === args.length - 1) {
				return fail('usage: echo <text> > <file>');
			}

			const text = args.slice(0, redirectIndex).join(' ');
			const file = args[redirectIndex + 1];
			const path = normalizePath(resolvePath(this.cwd, file));

			try {
				const data = new TextEncoder().encode(text);
				await this.kernel.fs_write_file(path, data);
				return ok('');
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				return fail(e.message);
			}
		});

		this.handlers.set('rm', async (args) => {
			if (args.length === 0) {
				return fail('usage: rm <file>');
			}

			const path = normalizePath(resolvePath(this.cwd, args[0]));

			try {
				await this.kernel.fs_rm(path);
				return ok('');
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				return fail(e.message);
			}
		});

		this.handlers.set('rmdir', async (args) => {
			if (args.length === 0) {
				return fail('usage: rmdir <directory>');
			}

			const path = normalizePath(resolvePath(this.cwd, args[0]));

			try {
				await this.kernel.fs_rmdir(path);
				return ok('');
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				return fail(e.message);
			}
		});

		this.handlers.set('mv', async (args) => {
			if (args.length < 2) {
				return fail('usage: mv <from> <to>');
			}

			const from = normalizePath(resolvePath(this.cwd, args[0]));
			const to = normalizePath(resolvePath(this.cwd, args[1]));

			try {
				await this.kernel.fs_mv(from, to);
				return ok('');
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				return fail(e.message);
			}
		});

		this.handlers.set('cp', async (args) => {
			if (args.length < 2) {
				return fail('usage: cp <from> <to>');
			}

			const from = normalizePath(resolvePath(this.cwd, args[0]));
			const to = normalizePath(resolvePath(this.cwd, args[1]));

			try {
				await this.kernel.fs_cp(from, to);
				return ok('');
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				return fail(e.message);
			}
		});

		this.handlers.set('stat', async (args) => {
			if (args.length === 0) {
				return fail('usage: stat <path>');
			}

			const path = normalizePath(resolvePath(this.cwd, args[0]));

			try {
				const stat = await this.kernel.fs_stat(path);
				const type = stat.is_dir ? 'directory' : 'file';
				const lines = [`Path: ${path}`, `Type: ${type}`, `Size: ${stat.size} bytes`];
				return ok(lines.join('\n'));
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				return fail(e.message);
			}
		});
	}

	private async buildTree(path: string, prefix: string, isRoot: boolean): Promise<string> {
		const lines: string[] = [];

		if (isRoot) {
			lines.push(path);
		}

		try {
			const entries = await this.kernel.fs_readdir(path);
			const dirEntries: string[] = [];
			const fileEntries: string[] = [];

			for (const entry of entries) {
				const entryPath = `${path === '/' ? '' : path}/${entry}`;
				try {
					const stat = await this.kernel.fs_stat(entryPath);
					if (stat.is_dir) {
						dirEntries.push(entry);
					} else {
						fileEntries.push(entry);
					}
				} catch {
					fileEntries.push(entry);
				}
			}

			dirEntries.sort();
			fileEntries.sort();
			const sorted = [...dirEntries, ...fileEntries];

			for (let i = 0; i < sorted.length; i++) {
				const entry = sorted[i];
				const entryPath = `${path === '/' ? '' : path}/${entry}`;
				const isLast = i === sorted.length - 1;
				const connector = isLast ? '└── ' : '├── ';

				try {
					const stat = await this.kernel.fs_stat(entryPath);
					if (stat.is_dir) {
						lines.push(`${prefix}${connector}${entry}/`);
						const nextPrefix = prefix + (isLast ? '    ' : '│   ');
						const subTree = await this.buildTree(entryPath, nextPrefix, false);
						const subLines = subTree.split('\n').filter((line) => line.length > 0);
						lines.push(...subLines);
					} else {
						lines.push(`${prefix}${connector}${entry}`);
					}
				} catch {
					lines.push(`${prefix}${connector}${entry}`);
				}
			}
		} catch {
			// Silently fail on directory read errors
		}

		return lines.join('\n');
	}
}

function ok(stdout: string): TerminalResult {
	return { stdout, stderr: '', code: 0 };
}

function fail(stderr: string, code = 1): TerminalResult {
	return { stdout: '', stderr, code };
}

export function tokenize(input: string): string[] {
	const out: string[] = [];
	let cur = '';
	let i = 0;
	let mode: 'none' | 'single' | 'double' = 'none';

	while (i < input.length) {
		const ch = input[i];

		if (mode === 'none') {
			if (/\s/.test(ch)) {
				if (cur) {
					out.push(cur);
					cur = '';
				}
				i++;
				continue;
			}
			if (ch === "'") {
				mode = 'single';
				i++;
				continue;
			}
			if (ch === '"') {
				mode = 'double';
				i++;
				continue;
			}
			cur += ch;
			i++;
			continue;
		}

		if (mode === 'single') {
			if (ch === "'") {
				mode = 'none';
				i++;
				continue;
			}
			cur += ch;
			i++;
			continue;
		}

		// double quotes
		if (ch === '"') {
			mode = 'none';
			i++;
			continue;
		}
		if (ch === '\\') {
			const next = input[i + 1] ?? '';
			if (next === 'n') cur += '\n';
			else if (next === 't') cur += '\t';
			else if (next === '"' || next === '\\') cur += next;
			else cur += next;
			i += 2;
			continue;
		}
		cur += ch;
		i++;
	}

	if (cur) out.push(cur);
	return out;
}

function resolvePath(cwd: string, p: string): string {
	if (!p || p === '.') return cwd;
	if (p.startsWith('/')) return p;
	return `${cwd.replace(/\/+$/, '')}/${p}`;
}

function normalizePath(path: string): string {
	const parts = path.split('/').filter((x) => x.length > 0);
	const stack: string[] = [];

	for (const part of parts) {
		if (part === '.') continue;
		if (part === '..') {
			stack.pop();
			continue;
		}
		stack.push(part);
	}

	return '/' + stack.join('/');
}
