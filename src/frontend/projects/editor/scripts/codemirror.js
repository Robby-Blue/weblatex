import {
    lineNumbers,
    highlightActiveLineGutter,
    highlightSpecialChars,
    drawSelection,
    rectangularSelection,
    highlightActiveLine,
    EditorView
} from "@codemirror/view"
import { EditorState } from "@codemirror/state"
import { history, historyKeymap, insertNewline } from "@codemirror/commands"
import { foldGutter, bracketMatching, foldKeymap } from "@codemirror/language"
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search"
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete"
import { lintKeymap } from "@codemirror/lint"
import { keymap } from "@codemirror/view"

import { latex, } from "codemirror-lang-latex"
import { oneDark } from "@codemirror/theme-one-dark"

export {
    EditorView, EditorState, latex,
    lineNumbers,
    highlightActiveLineGutter,
    highlightSpecialChars,
    drawSelection,
    rectangularSelection,
    highlightActiveLine,
    history,
    historyKeymap,
    foldGutter,
    bracketMatching,
    foldKeymap,
    searchKeymap,
    highlightSelectionMatches,
    autocompletion,
    completionKeymap,
    closeBrackets,
    closeBracketsKeymap,
    lintKeymap,
    keymap,
    insertNewline,
    oneDark
}