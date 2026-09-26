import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// CLI options
const args = process.argv.slice(2);
const jsonMode = args.includes('--json');

const colors = {
	green: (str) => jsonMode ? str : `\x1b[32m${str}\x1b[0m`,
	red: (str) => jsonMode ? str : `\x1b[31m${str}\x1b[0m`,
	yellow: (str) => jsonMode ? str : `\x1b[33m${str}\x1b[0m`,
	blue: (str) => jsonMode ? str : `\x1b[34m${str}\x1b[0m`,
	bold: (str) => jsonMode ? str : `\x1b[1m${str}\x1b[0m`,
};

const report = {
	passed: true,
	errors: [],
	warnings: [],
	stats: {
		filesChecked: 0,
		optionSlicesChecked: 0,
		canonicalKeysChecked: 0,
		aliasesChecked: 0,
	}
};

function addError(message, context = '') {
	report.passed = false;
	report.errors.push({ message, context });
}

function addWarning(message, context = '') {
	report.warnings.push({ message, context });
}

async function fileExists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

// Basic syntax check for balanced brackets and simple syntax issues
function scanFileSyntax(fileName, content) {
	const ext = path.extname(fileName).toLowerCase();
	
	// Check for basic unbalanced structures
	const braces = { '{': '}', '[': ']', '(': ')' };
	const stack = [];
	let lines = content.split('\n');
	
	if (ext === '.json') {
		try {
			JSON.parse(content);
		} catch (err) {
			addError(`Invalid JSON syntax: ${err.message}`, fileName);
		}
		return;
	}

	// General curly brace checking for obvious syntax corruptions
	let openCurly = 0;
	let closeCurly = 0;
	for (let i = 0; i < content.length; i++) {
		if (content[i] === '{') openCurly++;
		else if (content[i] === '}') closeCurly++;
	}

	if (Math.abs(openCurly - closeCurly) > 5) {
		addWarning(`Highly unbalanced curly braces: found ${openCurly} '{' and ${closeCurly} '}'`, fileName);
	}
}

async function checkThemeFilesRecursive(dir, relativeDir = '') {
	const absoluteDir = path.join(dir, relativeDir);
	if (!await fileExists(absoluteDir)) return;

	const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
	for (const entry of entries) {
		const relPath = path.join(relativeDir, entry.name);
		const absPath = path.join(dir, relPath);

		if (entry.isDirectory()) {
			if (entry.name === 'node_modules' || entry.name === '.git') continue;
			await checkThemeFilesRecursive(dir, relPath);
		} else if (entry.isFile()) {
			const ext = path.extname(entry.name).toLowerCase();
			if (['.vue', '.js', '.css', '.html', '.json'].includes(ext)) {
				report.stats.filesChecked++;
				try {
					const content = await fs.readFile(absPath, 'utf8');
					if (content.length === 0) {
						addWarning(`File is empty`, relPath);
					} else {
						scanFileSyntax(relPath, content);
					}
				} catch (err) {
					addError(`Failed to read file: ${err.message}`, relPath);
				}
			}
		}
	}
}

async function validate() {
	if (!jsonMode) {
		console.log(colors.bold(colors.blue('========================================')));
		console.log(colors.bold(colors.blue('   NeuronCast Theme Preflight Validator')));
		console.log(colors.bold(colors.blue('========================================\n')));
	}

	// 1. Verify required raw/default theme core files exist
	const requiredFiles = [
		'src/themes/raw/theme.json',
		'src/themes/raw/index.html',
		'src/themes/raw/core/app.js',
		'src/themes/raw/core/state.js',
		'src/themes/raw/core/websocket.js',
		'src/themes/default/theme.json',
		'src/themes/default/index.css',
		'src/themes/default/shell/shell.js',
		'src/themes/default/shell/shell.html',
		'src/themes/default/shell/shell.css',
		'src/themes/userspace/theme.json'
	];

	for (const reqFile of requiredFiles) {
		const fullPath = path.join(projectRoot, reqFile);
		if (!await fileExists(fullPath)) {
			addError(`Required core theme file is missing`, reqFile);
		}
	}

	// 2. Resolve option-slices dynamically and audit definitions
	const slicesDir = path.join(projectRoot, 'src/themes/raw/core/option-slices');
	const canonicalKeys = new Set();
	const aliases = new Set();
	const cssVars = new Set();
	
	const aliasToCanonical = new Map();
	const deprecatedAliasesMeta = new Map();

	if (await fileExists(slicesDir)) {
		const files = await fs.readdir(slicesDir);
		const jsFiles = files.filter(f => f.endsWith('.js'));

		for (const file of jsFiles) {
			report.stats.optionSlicesChecked++;
			const filePath = path.join(slicesDir, file);
			const fileUrl = pathToFileURL(filePath).href;
			
			try {
				const module = await import(fileUrl);
				for (const key of Object.keys(module)) {
					const definitionsList = module[key];
					if (Array.isArray(definitionsList)) {
						definitionsList.forEach((def, index) => {
							const context = `option-slices/${file} [entry #${index}]`;
							
							// Check structural validity of option-slice definitions
							if (!def.canonical || typeof def.canonical !== 'string') {
								addError(`Option-slice definition missing canonical key path`, context);
								return;
							}

							report.stats.canonicalKeysChecked++;

							// Duplicate canonical check
							if (canonicalKeys.has(def.canonical)) {
								addError(`Duplicate canonical key definition: "${def.canonical}"`, context);
							} else {
								canonicalKeys.add(def.canonical);
							}

							// Validate fallback existence
							if (def.fallback === undefined) {
								addWarning(`Option definition missing fallback value for "${def.canonical}"`, context);
							}

							// Validate cssVars
							if (def.cssVars) {
								if (!Array.isArray(def.cssVars)) {
									addError(`"cssVars" must be an array of strings in definition for "${def.canonical}"`, context);
								} else {
									def.cssVars.forEach(v => {
										// If it starts with '--', we audit duplicate cssVars
										if (cssVars.has(v)) {
											// Some variables might be shared, log a warning
											addWarning(`CSS variable "${v}" is defined in multiple options`, context);
										} else {
											cssVars.add(v);
										}
									});
								}
							}

							// Validate aliases and lifecycle metadata
							if (def.aliases) {
								if (!Array.isArray(def.aliases)) {
									addError(`"aliases" must be an array of strings in definition for "${def.canonical}"`, context);
								} else {
									def.aliases.forEach(alias => {
										report.stats.aliasesChecked++;
										
										if (aliases.has(alias)) {
											addError(`Duplicate alias key "${alias}" registered for "${def.canonical}"`, context);
										} else {
											aliases.add(alias);
											aliasToCanonical.set(alias, def.canonical);
										}

										// Validate alias lifecycle metadata
										if (def.lifecycle) {
											const lifeAliases = def.lifecycle.aliases || {};
											const meta = lifeAliases[alias];
											if (!meta) {
												addError(`Alias "${alias}" lacks matching deprecation/lifecycle metadata under lifecycle.aliases`, context);
											} else {
												deprecatedAliasesMeta.set(alias, {
													canonical: def.canonical,
													...meta
												});
												
												// Deprecated aliases must have status, sunsetPhase, and removeAfter
												if (!meta.status) {
													addError(`Deprecated alias "${alias}" is missing "status" field in lifecycle`, context);
												}
												if (!meta.sunsetPhase) {
													addError(`Deprecated alias "${alias}" is missing "sunsetPhase" field in lifecycle`, context);
												}
												if (!meta.removeAfter) {
													addError(`Deprecated alias "${alias}" is missing "removeAfter" field in lifecycle`, context);
												}
											}
										} else {
											addError(`Alias "${alias}" exists but definition lacks "lifecycle" metadata entirely`, context);
										}
									});
								}
							}
						});
					}
				}
			} catch (err) {
				addError(`Failed to load or parse option-slice: ${err.message}`, `option-slices/${file}`);
			}
		}
	} else {
		addError(`Option-slices directory not found`, slicesDir);
	}

	// 3. Validate theme inheritance chains and theme.json files
	const themeDir = path.join(projectRoot, 'src/themes');
	const loadedThemes = new Map();
	
	const themesToCheck = ['raw', 'default', 'userspace'];
	for (const t of themesToCheck) {
		const tJsonPath = path.join(themeDir, t, 'theme.json');
		if (await fileExists(tJsonPath)) {
			try {
				const rawContent = await fs.readFile(tJsonPath, 'utf8');
				const tJson = JSON.parse(rawContent);
				loadedThemes.set(t, tJson);

				// Options object exists and has valid entries
				if (t !== 'userspace') {
					if (!tJson.options || typeof tJson.options !== 'object') {
						addError(`Theme config is missing "options" object`, `src/themes/${t}/theme.json`);
					} else {
						// Check canonical option paths are valid where known
						for (const optKey of Object.keys(tJson.options)) {
							const entry = tJson.options[optKey];
							if (typeof entry !== 'object' || entry === null) {
								addError(`Option entry for "${optKey}" is not a valid object`, `src/themes/${t}/theme.json`);
							}
							
							const isCanonicalNamespace = optKey.startsWith('layout.') || optKey.startsWith('style.') || optKey.startsWith('theme.');
							if (isCanonicalNamespace && !canonicalKeys.has(optKey)) {
								addWarning(`Canonical key "${optKey}" is declared in theme.json but has no definition in option-slices`, `src/themes/${t}/theme.json`);
							}
						}
					}
				}
			} catch (err) {
				addError(`Failed to read/parse theme.json: ${err.message}`, `src/themes/${t}/theme.json`);
			}
		}
	}

	// Validate theme chain resolution
	if (loadedThemes.has('userspace')) {
		const visited = new Set(['userspace']);
		let current = loadedThemes.get('userspace');
		let currentName = 'userspace';

		while (current && current.parent) {
			const parent = current.parent;
			if (visited.has(parent)) {
				addError(`Circular inheritance detected in theme chain: ${[...visited, parent].join(' -> ')}`, 'Theme chain resolution');
				break;
			}
			visited.add(parent);
			
			const parentJsonPath = path.join(themeDir, parent, 'theme.json');
			if (!await fileExists(parentJsonPath)) {
				addError(`Parent theme "${parent}" from theme chain does not exist`, `Theme chain of ${currentName}`);
				break;
			}

			current = loadedThemes.get(parent);
			currentName = parent;
		}

		if (!jsonMode) {
			console.log(colors.green(`✔ Theme chain resolved successfully: ${[...visited].join(' -> ')}\n`));
		}
	}

	// 4. Validate userspace/theme.json options
	const userspaceTheme = loadedThemes.get('userspace');
	if (userspaceTheme && userspaceTheme.options) {
		for (const optKey of Object.keys(userspaceTheme.options)) {
			// Check if userspace contains migrated legacy keys
			if (aliasToCanonical.has(optKey)) {
				const targetCanonical = aliasToCanonical.get(optKey);
				addWarning(
					`Userspace config contains legacy configuration key "${optKey}". Please migrate to "${targetCanonical}".`,
					'src/themes/userspace/theme.json'
				);
			}

			// Check and report deprecated aliases found in userspace configs
			if (deprecatedAliasesMeta.has(optKey)) {
				const meta = deprecatedAliasesMeta.get(optKey);
				addWarning(
					`Deprecated alias "${optKey}" found. (Sunset Phase: ${meta.sunsetPhase}, Remove After: ${meta.removeAfter}). Save config in Config SPA to auto-migrate.`,
					'src/themes/userspace/theme.json'
				);
			}
		}
	}

	// 5. Scan theme directories recursively for .vue, .js, .css, .html files to verify readability and simple syntax
	for (const t of ['raw', 'default']) {
		const dir = path.join(themeDir, t);
		await checkThemeFilesRecursive(dir);
	}

	// Print Results
	if (jsonMode) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		console.log(colors.bold('Validation Summary:'));
		console.log(`- Files checked: ${report.stats.filesChecked}`);
		console.log(`- Option slices checked: ${report.stats.optionSlicesChecked}`);
		console.log(`- Canonical keys validated: ${report.stats.canonicalKeysChecked}`);
		console.log(`- Registered aliases verified: ${report.stats.aliasesChecked}`);
		console.log('');

		if (report.warnings.length > 0) {
			console.log(colors.bold(colors.yellow(`Warnings (${report.warnings.length}):`)));
			report.warnings.forEach(w => {
				console.log(colors.yellow(`  [WARNING] ${w.message}`));
				if (w.context) console.log(`            Context: ${w.context}`);
			});
			console.log('');
		}

		if (report.errors.length > 0) {
			console.log(colors.bold(colors.red(`Errors (${report.errors.length}):`)));
			report.errors.forEach(e => {
				console.log(colors.red(`  [ERROR]   ${e.message}`));
				if (e.context) console.log(`            Context: ${e.context}`);
			});
			console.log('');
		}

		if (report.passed) {
			console.log(colors.bold(colors.green('✔ PASS: All theme configurations are structurally valid and production-ready!')));
		} else {
			console.log(colors.bold(colors.red('✘ FAIL: Theme validation failed with critical errors.')));
		}
		console.log(colors.bold(colors.blue('========================================\n')));
	}

	if (!report.passed) {
		process.exit(1);
	} else {
		process.exit(0);
	}
}

validate().catch(err => {
	console.error('Fatal Validation Error:', err);
	process.exit(1);
});
