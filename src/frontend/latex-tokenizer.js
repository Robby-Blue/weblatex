// good luck refactoring this
export function tokenize(src) {
  let tokenTypes = [
    {
      name: "command",
      start: [{ type: "char", char: "\\" }],
      end: [{ type: "nonalphabetic" }],
    },
    {
      name: "brackets",
      start: [
        { type: "char", char: "{" },
        { type: "char", char: "[" },
      ],
      end: [
        { type: "char", char: "]", inclusive: true },
        { type: "char", char: "}", inclusive: true },
      ],
    },
    {
      name: "inlinemath",
      start: [
        { type: "char", char: "$" },
        { type: "char", char: "\\(" },
      ],
      end: [
        { type: "char", char: "$", inclusive: true },
        { type: "char", char: "\\)", inclusive: true },
      ],
    },
    {
      name: "math",
      start: [{ type: "char", char: "\\[" }],
      end: [{ type: "char", char: "\\]", inclusive: true }],
    },
    {
      name: "comment",
      start: [{ type: "char", char: "%" }],
      end: [{ type: "char", char: "\n" }],
    },
  ];

  let activeTokens = [];
  let tokens = [];
  tokens.push({ type: { name: "default" }, text: "" });
  let i = 0;

  while (i < src.length) {
    let bestMatch = null;
    let bestScore = 0;
    for (let tokenType of tokenTypes) {
      for (let startCondition of tokenType.start) {
        let thisMatch = meetsTokenCondition(startCondition, src, i);
        if (thisMatch > bestScore) {
          bestMatch = { type: "start", token: tokenType };
          bestScore = thisMatch;
        }
      }
    }
    if (activeTokens.length > 0) {
      for (let endCondition of activeTokens.at(-1).end) {
        let thisMatch = meetsTokenCondition(endCondition, src, i);
        if (thisMatch) {
          thisMatch += 1;
        }
        if (thisMatch > bestScore) {
          bestMatch = { type: "stop", condition: endCondition };
          bestScore = thisMatch;
        }
      }
    }
    if (bestMatch) {
      if (bestMatch.type == "start") {
        tokens.push({ type: bestMatch.token, text: "" });
        activeTokens.push(bestMatch.token);
        for (let k = 0; k < bestScore; k++) {
          tokens.at(-1).text += src[i++];
          if (i == src.length) break;
        }
      }

      if (activeTokens.length > 0 && bestMatch.type == "stop") {
        if (bestMatch.condition.inclusive) {
          for (let k = 0; k < bestScore - 1; k++) {
            tokens.at(-1).text += src[i++];
            if (i == src.length) break;
          }
        }
        activeTokens.pop();
        let newTokenType = { name: "default" };
        if (activeTokens.length > 0) {
          newTokenType = activeTokens.at(-1);
        }
        tokens.push({ type: newTokenType, text: "" });
      }
    } else {
      tokens.at(-1).text += src[i++];
    }
  }
  return tokens;
}

function meetsTokenCondition(condition, src, index) {
  if (condition.type == "any") {
    return 1;
  } else if (condition.type == "char") {
    let len = condition.char.length;
    return src.slice(index, index + len) == condition.char ? len : 0;
  } else if (condition.type == "nonalphabetic") {
    return !src[index].match(/[a-z]/i) ? 1 : 0;
  }
}
