// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const SETTINGS = "overwriteTerminalFileLink";
const MAPPING = "overwrite";
const FILELINECOL = "fileLineColPatterns";

class FileAndPos {
	constructor(public filePath: string, public line: number | undefined, public col: number | undefined) { }
}

class TerminalLink implements vscode.TerminalLink {
	constructor(public startIndex: number, public length: number, public fap: FileAndPos) { }
}

class TerminalLinkProvider implements vscode.TerminalLinkProvider {
	private _debug: boolean;

	constructor(
		private logOut: vscode.OutputChannel) {
			this._debug = false;
	}

	debugLog(message: string)
	{
		if (this._debug)
		{
			this.logOut.appendLine(message);
		}
	}

	getSettingFromJson() {
		// Get the path to the .vscode/settings.json file
		if (vscode.workspace.workspaceFolders)
		{
			let root = vscode.workspace.workspaceFolders[0].uri.fsPath;		
			const settingsPath = path.join(root || '', '.vscode', 'settings.json');
			this.debugLog('Checking ' + settingsPath);
			// Check if the settings.json file exists
			if (fs.existsSync(settingsPath)) {
				let settingsContent = fs.readFileSync(settingsPath, 'utf8');
				// remove single line comments (//)
				settingsContent = settingsContent.replace(/\/\/.*$/gm, '');
				// remove block comments (/* */)
				settingsContent = settingsContent.replace(/\/\*[\s\S]*?\*\//gm, '');

				let settingsJson = '';
				try{
					settingsJson = JSON.parse(settingsContent);
				} catch (e){
					if (typeof e === 'string')
					{
						this.debugLog(e);
						this.debugLog('Failed to parse setting.json. Error: ' +  e);
					}
					else if (e instanceof Error)
					{
						this.debugLog(e.message);
						this.debugLog('Failed to parse setting.json: ' + e.message);
					}
				}
				
				return settingsJson;
			} else {				
				this.debugLog('.vscode/settings.json not found.');
				return {};
			}
		}
		// Handle the case where the settings.json file does not exist
		this.debugLog('.vscode/settings.json not found.');
		return {};
	}

	getSetting(section: string)
	{
		let conf = vscode.workspace.getConfiguration(SETTINGS);
		let confInspect = conf.inspect(MAPPING)?.workspaceValue as {string:string}[];
		if (confInspect)
		{
			return confInspect;
		}
		// The vscode.workspace.getConfiguration shoud get settings from .vscode/settings.json but it can be overrided by settings 
		// from code-workspace file so try to load the settings from the .vscode/settings.json directly
		//type MySettings = {[key: string]: any};		
		let settings = this.getSettingFromJson() as {[key: string]: any};
		if (settings.hasOwnProperty(SETTINGS) && settings[SETTINGS].hasOwnProperty(section))
		{
			return settings[SETTINGS][section];
		}
	}

	provideTerminalLinks(context: vscode.TerminalLinkContext, token: vscode.CancellationToken): vscode.ProviderResult<TerminalLink[]> {
		return new Promise((resolve) => {
			const results: TerminalLink[] = [];			
			let mapping = this.getSetting(MAPPING);
			let lineColPatterns = this.getSetting(FILELINECOL);
			this.debugLog("Resolving context: '" + context.line);
			let linkResolved = false;

			for (let [rex, target] of Object.entries(mapping)) {
				let regexstr = JSON.parse(JSON.stringify(rex)).toString();
				let regEx = new RegExp(JSON.parse(JSON.stringify(rex)).toString());
				let match = regEx.exec(context.line);
				this.debugLog("Regex: " + regexstr);
				if (match !== null)
				{
					// replace the match by target
					let message = match.input.replace(match[0], target as string);
					//find line and col
					let line = 0, col = 0;
					let file = null;
					//for (let lineColPatt of Object.entries(lineColPatterns))
					for (let i = 0; i < lineColPatterns.length; i++)
					{
						let lineCol = lineColPatterns[i];						
						let fg = lineCol.file;
						let lg = lineCol.line;
						let cg = lineCol.col;
						let rexLineCol = new RegExp(JSON.parse(JSON.stringify(lineCol.pattern)).toString());
						this.debugLog("Checking fileLineColPattern: " + JSON.parse(JSON.stringify(lineCol.pattern)).toString());
						let matchLineCol = rexLineCol.exec(message);
						if (matchLineCol !== null)
						{
							if (fg >= 0 && fg < matchLineCol.length)
							{
								file = matchLineCol[fg];
								this.debugLog("Found file: " + file);
							}
							if (lg >= 0 && lg < matchLineCol.length)
							{
								line = parseInt(matchLineCol[lg]);
								this.debugLog("Found line: " + line);
							}
							if (cg >= 0 && cg < matchLineCol.length)
							{
								col = parseInt(matchLineCol[cg]);
								this.debugLog("Found col: " + col);
							}
							break;
						}
						else
						{
							this.debugLog("Pattern not matched");
						}
					}
					if (file !== null && vscode.workspace.workspaceFolders)
					{
						let f = vscode.workspace.workspaceFolders[0].uri.path + '/' + file;
						this.debugLog("Overwriten file path: " + f);
						const fap = new FileAndPos(f, line, col);
						results.push(new TerminalLink(0, f.length, fap));
						resolve(results);
						linkResolved = true;
						break;
					}						
				}
				else
				{
					this.debugLog("Pattern not matched.");
				}
				if (linkResolved)
				{
					break;
				}
			}
		});
	}
	handleTerminalLink(link: TerminalLink): vscode.ProviderResult<void> {
		this.logOut.appendLine("Opening " + link.fap.filePath);
		let uf = Uri.file(link.fap.filePath);

		try
		{
			vscode.commands.executeCommand('vscode.open', uf).then(() => {

				const editor = vscode.window.activeTextEditor;
				if (!editor || link.fap.line === undefined) { return; }
				let line = link.fap.line - 1 < 0 ? 0 : link.fap.line - 1;				
				let col = 0;
				if (link.fap.col !== undefined) {
					col = link.fap.col - 1 < 0 ? 0 : link.fap.col - 1;
				}
				editor.selection = new vscode.Selection(line, col, line, col);
				editor.revealRange(new vscode.Range(line, 0, line, 10000));
			});
		}
		catch (e)
		{
			if (typeof e === 'string')
			{
				this.debugLog(e);
			}
			else if (e instanceof Error)
			{
				this.debugLog(e.message);
			}
		}
	}
}

export function activate(context: vscode.ExtensionContext) {
	let logOut = vscode.window.createOutputChannel("Overwrite Terminal File Link");
	const init = () => {

		logOut.appendLine("Initializing extension...");

		while (context.subscriptions.length > 1) {
			context.subscriptions.pop()?.dispose();
		}	

		context.subscriptions.push(
			vscode.window.registerTerminalLinkProvider(new TerminalLinkProvider(logOut)));
		
		logOut.appendLine("Extension Initialized.");
	};
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration(SETTINGS)) {
				init();
			}
		}));

	init();
}

export function deactivate() { }
