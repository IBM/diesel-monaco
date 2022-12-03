import * as vscode from 'vscode';
import { CompletionItemKind} from 'vscode-languageserver-protocol';
import {DieselParserFacade} from "@diesel-parser/ts-facade";
import { TextDocument } from 'vscode-languageserver-textdocument';

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
