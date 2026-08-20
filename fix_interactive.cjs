const fs = require('fs');
let code = fs.readFileSync('src/components/InteractiveConsole.tsx', 'utf8');

code = code.replace(
  "let currentStep = 0;",
  "let currentStep = 0;\n    let timeoutId: any;"
);

code = code.replace(
  "setTimeout(() => {",
  "timeoutId = setTimeout(() => {"
);

code = code.replace(
  "    };\n\n    runNextStep();\n  }, [isScraping, captchaSolved]);",
  "    };\n\n    runNextStep();\n\n    return () => {\n      if (timeoutId) clearTimeout(timeoutId);\n    };\n  }, [isScraping, captchaSolved]);"
);

fs.writeFileSync('src/components/InteractiveConsole.tsx', code);
