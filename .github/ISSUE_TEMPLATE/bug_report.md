---
name: Bug report
about: Create a report to help us improve NAVI
title: '[BUG] '
labels: 'bug'
assignees: ''

---

## 🐛 Bug Description
A clear and concise description of what the bug is.

## 🔄 Steps to Reproduce
Steps to reproduce the behavior:
1. Run command '...'
2. With parameters '...'
3. See error

## ✅ Expected Behavior
A clear and concise description of what you expected to happen.

## ❌ Actual Behavior
A clear and concise description of what actually happened.

## 📋 Environment
- **OS**: [e.g. macOS 14.0, Ubuntu 22.04, Windows 11]
- **Node.js version**: [e.g. 18.17.0]
- **npm version**: [e.g. 9.6.7]
- **NAVI version**: [e.g. 1.0.0]

## 📝 Sample Code
If applicable, add minimal code to reproduce the issue:

```bash
# Example command that causes the issue
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"tool-name","arguments":{}}}' | npm start
```

## 📊 Error Output
```
Paste the full error output here
```

## 📁 Project Structure (if relevant)
If the bug is related to analyzing a specific project structure, please provide:
```
project/
├── file1.ts
├── file2.js
└── folder/
    └── file3.py
```

## 📸 Screenshots
If applicable, add screenshots to help explain your problem.

## 🔍 Additional Context
Add any other context about the problem here.

## ✅ Checklist
- [ ] I have searched existing issues to ensure this is not a duplicate
- [ ] I have provided all the requested information
- [ ] I have tested with the latest version of NAVI
- [ ] I have included a minimal reproduction case
