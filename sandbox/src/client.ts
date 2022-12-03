/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2018-2022 TypeFox GmbH (http://www.typefox.io). All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

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

import { buildWorkerDefinition } from 'monaco-editor-workers';

// import { getLanguageService, TextDocument } from 'vscode-json-languageservice';
// import { createConverter as createCodeConverter } from 'vscode-languageclient/lib/common/codeConverter.js';
import { createConverter as createProtocolConverter } from 'vscode-languageclient/lib/common/protocolConverter.js';
import { StandaloneServices } from 'vscode/services';
import getMessageServiceOverride from 'vscode/service-override/messages';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItemKind, Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-protocol';
import { DieselParserFacade } from '@diesel-parser/ts-facade';

// @ts-ignore
import { DieselSamples } from '@diesel-parser/samples';
import {registerCompletion, registerSemanticHighlight} from "@diesel-parser/monaco";

StandaloneServices.initialize({
    ...getMessageServiceOverride(document.body)
});

buildWorkerDefinition('dist', new URL('', window.location.href).href, false);
// const codeConverter = createCodeConverter();
const protocolConverter = createProtocolConverter(undefined, true, true);

const LANGUAGE_ID = 'bmd';
const MODEL_URI = 'inmemory://model.bmd';
const MONACO_URI = monaco.Uri.parse(MODEL_URI);

// register the JSON language with Monaco
monaco.languages.register({
    id: LANGUAGE_ID,
    extensions: ['.bmd'],
    aliases: ['BMD', 'bmd'],
    mimetypes: ['application/bmd']
});

// create the Monaco editor
const value = `a duck is a concept`;
const model = monaco.editor.createModel(value, LANGUAGE_ID, MONACO_URI);
monaco.editor.create(document.getElementById('container')!, {
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

const vscodeDocument = vscode.workspace.textDocuments[0];

function getTokenType(styleName: string): string | undefined {
    switch (styleName) {
        case "number":
        case "string":
        case "keyword":
            return styleName;
        case "attr":
            return "property";
    }
    return undefined;
}

const tokenTypes = ['number', 'string', 'keyword', 'property'];

function createDocument(vscodeDocument: vscode.TextDocument) {
    return TextDocument.create(MODEL_URI, vscodeDocument.languageId, vscodeDocument.version, vscodeDocument.getText());
}

// @ts-ignore
const dieselParser: DieselParserFacade = DieselSamples.createBmdParser();

registerCompletion(MODEL_URI, LANGUAGE_ID, () => dieselParser);
registerSemanticHighlight(LANGUAGE_ID, () => dieselParser, tokenTypes, getTokenType);

const pendingValidationRequests = new Map<string, number>();

model.onDidChangeContent((_event) => {
    validate();
});
validate();
// debugger;
// dieselMonaco.validate(vscodeDocument);



function validate(): void {
    const document = createDocument(vscodeDocument);
    cleanPendingValidation(document);
    pendingValidationRequests.set(document.uri, window.setTimeout(() => {
        pendingValidationRequests.delete(document.uri);
        doValidate(document);
    }));
}

function cleanPendingValidation(document: TextDocument): void {
    const request = pendingValidationRequests.get(document.uri);
    if (request !== undefined) {
        window.clearTimeout(request);
        pendingValidationRequests.delete(document.uri);
    }
}

const SEV_MAP: { [key: string]: DiagnosticSeverity } = {
	"info": DiagnosticSeverity.Information,
	"warning": DiagnosticSeverity.Warning,
	"error": DiagnosticSeverity.Error
};

const diagnosticCollection = vscode.languages.createDiagnosticCollection('diesel');
function doValidate(document: TextDocument): void {

    const text = document.getText();
    if (text.length === 0) {
        cleanDiagnostics();
        return;
    }

    const parseResult = dieselParser.parse({text});
    if (!parseResult.success) {
        console.error("unable to parse", parseResult.error);
        return;
    }

    const diagnostics: Diagnostic[] = [];
	if (parseResult.success) {
		// it's ok, look for markers
		parseResult.markers.forEach(marker => {
			diagnostics.push({
                message: marker.getMessage("en"), // TODO
                range: {
                    start: document.positionAt(marker.offset),
                    end: document.positionAt(marker.offset + marker.length)
                },
                severity: SEV_MAP[marker.severity] ?? DiagnosticSeverity.Error
            });
		});
	} else {
		// parsing error
		// TODO better logging
		diagnostics.push({
            message: parseResult.error ?? "Unhandled parsing error :/",
            range: {
                start: document.positionAt(0),
                end: document.positionAt(text.length)
            },
            severity: DiagnosticSeverity.Error
        });
	}

   protocolConverter.asDiagnostics(diagnostics).then(ds => {
        diagnosticCollection.set(MONACO_URI, ds);
    });
}

function cleanDiagnostics(): void {
    diagnosticCollection.clear();
}
