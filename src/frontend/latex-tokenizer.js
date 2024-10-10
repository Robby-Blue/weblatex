// good luck refactoring this
export function tokenize(src) {
  let tokenTypes = [
    {
      name: "command",
      start: [{ func: command() }],
      end: [{ func: nonalphabetic() }],
    },
    {
      name: "brackets",
      start: [
        { func: char("{") },
        { func: char("[") },
      ],
      end: [
        { func: char("]"), inclusive: true },
        { func: char("}"), inclusive: true },
      ],
    },
    {
      name: "inlinemath",
      start: [
        { func: char("$") },
        { func: char("\\(") },
      ],
      end: [
        { func: char("$"), inclusive: true },
        { func: char("\\)"), inclusive: true },
      ],
    },
    {
      name: "math",
      start: [{ func: char("\\[") }],
      end: [{ func: char("\\]"), inclusive: true }],
    },
    {
      name: "comment",
      start: [{ func: char("%") }],
      end: [{ func: char("\n") }],
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
        let thisMatch = startCondition.func(src, i);
        if(i>0 && src[i-1] == "\\"){
          thisMatch = 0
        }
        if (thisMatch > bestScore) {
          bestMatch = { type: "start", token: tokenType };
          bestScore = thisMatch;
        }
      }
    }
    if (activeTokens.length > 0) {
      for (let endCondition of activeTokens.at(-1).end) {
        let thisMatch = endCondition.func(src, i);
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

function char(text) {
  return (src, index) => {
    return src.slice(index, index + text.length) == text ? text.length : 0;
  }
}

function nonalphabetic() {
  return (src, index) => {
    return !src[index].match(/[a-z0-9]/i) ? 1 : 0;
  }
}

function command() {
  return (src, index) => {
    return char("\\")(src, index) &&
      !nonalphabetic()(src, index + 1);
  }
}