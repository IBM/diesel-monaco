import 'monaco-editor/esm/vs/editor/editor.all.js';

// support all editor features
import 'monaco-editor/esm/vs/editor/standalone/browser/accessibilityHelp/accessibilityHelp.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/inspectTokens/inspectTokens.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/iPadShowKeyboard/iPadShowKeyboard.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneHelpQuickAccess.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoSymbolQuickAccess.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/quickInput/standaloneQuickInputService.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/referenceSearch/standaloneReferenceSearch.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/toggleHighContrast/toggleHighContrast.js';

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import * as vscode from 'vscode';

import {buildWorkerDefinition} from 'monaco-editor-workers';
import {DieselParserFacade} from '@diesel-parser/ts-facade';

// @ts-ignore
import {DieselSamples} from '@diesel-parser/samples';
import {DieselMonaco} from '@diesel-parser/monaco';

buildWorkerDefinition('.', new URL('', window.location.href).href, false);

const LANGUAGE_ID = 'bmd';
const MODEL_URI = 'inmemory://model.bmd';
const MONACO_URI = monaco.Uri.parse(MODEL_URI);

// register the language with Monaco
monaco.languages.register({
    id: LANGUAGE_ID,
    extensions: ['.bmd'],
    aliases: ['BMD', 'bmd'],
    mimetypes: ['application/bmd']
});

// create the Monaco editor

const value = `start with a MyClass.
a MyClass is a concept.
a MyClass has a foo (text).`;

const model = monaco.editor.createModel(value, LANGUAGE_ID, MONACO_URI);
const monacoEditor = monaco.editor.create(document.getElementById('container')!, {
    model,
    glyphMargin: false,
    lightbulb: {
        enabled: true
    },
    automaticLayout: false,
    'semanticHighlighting.enabled': true,
    minimap: {
        enabled: false
    }
});
// WTF?
(monacoEditor.getContribution("editor.contrib.suggestController") as any).widget.value._setDetailsVisible(true);

const vscodeDocument = vscode.workspace.textDocuments[0];

// @ts-ignore
const dieselParser: DieselParserFacade = DieselSamples.createBmdParser();

const dieselMonaco = new DieselMonaco(
    MODEL_URI,
    MONACO_URI,
    LANGUAGE_ID,
    () => dieselParser,
    () => "aCompileUnit",
    ['keyword', 'type', 'enumMember'],
    getTokenType,
    vscodeDocument
);
dieselMonaco.registerCompletion();
dieselMonaco.registerSemanticHighlight();
model.onDidChangeContent((_event) => {
    dieselMonaco.validateDocument();
});
dieselMonaco.validateDocument();


// function getTokenType(styleName: string): string | undefined {
//     switch (styleName) {
//         case "number":
//         case "string":
//         case "keyword":
//             return styleName;
//         case "attr":
//             return "property";
//     }
//     return undefined;
// }

function getTokenType(styleName: string): string | undefined {
    switch (styleName) {
        case "keyword":
            return styleName;
        case "builtin-type":
            return "type";
        case "domain-value":
            return "enumMember"
    }
    return undefined;
}
