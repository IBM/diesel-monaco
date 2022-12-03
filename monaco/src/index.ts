// import * as vscode from 'vscode';
//
// export function registerCompletion(languageId: string) {
//     vscode.languages.registerCompletionItemProvider(languageId, {
//         async provideCompletionItems(vscodeDocument, position, _token, _context) {
//             // const document = createDocument(vscodeDocument);
//             // const predictRequest = { text: document.getText(), offset: document.offsetAt(position) };
//             // const predictResult = dieselParser.predict(predictRequest);
//             // if (!predictResult.success) {
//             //     console.error("unable to predict", predictResult.error);
//             //     return;
//             // }
//             // return predictResult.proposals.map(p => {
//             //     return {
//             //         label: p.text,
//             //         kind: CompletionItemKind.Text,
//             //         data: p,
//             //     };
//             // });
//             return null;
//         }
//     });
// }

export * from "./diesel-monaco";