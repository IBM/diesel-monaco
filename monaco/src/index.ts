import * as vscode from 'vscode';
import { CompletionItemKind} from 'vscode-languageserver-protocol';
import {DieselParserFacade} from "@diesel-parser/ts-facade";
import { TextDocument } from 'vscode-languageserver-textdocument';
import {Diagnostic, DiagnosticSeverity} from 'vscode-languageserver-protocol';
import {createConverter as createProtocolConverter} from 'vscode-languageclient/lib/common/protocolConverter.js';
import {StandaloneServices} from 'vscode/services';
import getMessageServiceOverride from 'vscode/service-override/messages';

StandaloneServices.initialize({
    ...getMessageServiceOverride(document.body)
});

function createDocument(modelUri: string,vscodeDocument: vscode.TextDocument) {
    return TextDocument.create(modelUri, vscodeDocument.languageId, vscodeDocument.version, vscodeDocument.getText());
}

export function registerCompletion(
    modelUri: string,
    languageId: string,
    parser: () => DieselParserFacade) {
        vscode.languages.registerCompletionItemProvider(languageId, {
            async provideCompletionItems(vscodeDocument, position, _token, _context) {
                const document = createDocument(modelUri, vscodeDocument);
                const predictRequest = { text: document.getText(), offset: document.offsetAt(position) };
                const predictResult = parser().predict(predictRequest);
                if (!predictResult.success) {
                    console.error("unable to predict", predictResult.error);
                    return;
                }
                return predictResult.proposals.map(p => {
                    return {
                        label: p.text,
                        kind: CompletionItemKind.Text,
                        data: p,
                    };
                });
            }
        });
    }

export function registerSemanticHighlight(
    languageId: string,
    parser: () => DieselParserFacade,
    tokenTypes: string[],
    styleToToken: (styleName:string) => string | undefined) {
        const legend = new vscode.SemanticTokensLegend(tokenTypes, []);
        vscode.languages.registerDocumentSemanticTokensProvider(languageId, {
            async provideDocumentSemanticTokens(document) {
                const parseRequest = { text: document.getText() };
                const parseResult = parser().parse(parseRequest);
                const builder = new vscode.SemanticTokensBuilder(legend);
                if (parseResult.success) {
                    // it's ok, look for styles
                    parseResult.styles.forEach(style => {
                        const tokenType = styleToToken(style.name);
                        if (tokenType) {
                            builder.push(
                                new vscode.Range(
                                    document.positionAt(style.offset),
                                document.positionAt(style.offset + style.length)
                            ),
                            tokenType
                        )
                    }
                });
                } else {
                    // parsing error
                    console.error("Unhandled parsing error, styles will not be available");
                }
                return builder.build();
            }
        }, {
            tokenTypes,
            tokenModifiers: []
        }
    );
}

const pendingValidationRequests = new Map<string, number>();

export function validate(modelUri: string, monacoUri: vscode.Uri, vscodeDocument: vscode.TextDocument, parser: DieselParserFacade): void {
    const document = createDocument(modelUri, vscodeDocument);
    cleanPendingValidation(document);
    pendingValidationRequests.set(document.uri, window.setTimeout(() => {
        pendingValidationRequests.delete(document.uri);
        doValidate(monacoUri, parser, document);
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

const protocolConverter = createProtocolConverter(undefined, true, true);
const diagnosticCollection = vscode.languages.createDiagnosticCollection('diesel');

function doValidate(monacoUri: vscode.Uri, parser: DieselParserFacade, document: TextDocument): void {

    const text = document.getText();
    if (text.length === 0) {
        cleanDiagnostics();
        return;
    }

    const parseResult = parser.parse({text});
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
        diagnosticCollection.set(monacoUri, ds);
    });
}

function cleanDiagnostics(): void {
    diagnosticCollection.clear();
}
