## Features

The motivation to create this extension was to solve the following problem:

 * The source files are e.g. in the directory `${workspaceFolder}/src/myapp`
 * This directory has a symlink to `${workspaceFolder}/build/app/myapp`
 * The directory `${workspaceFolder}/build/app/myapp` is excluded from VS Code searches to avoid duplicating search results.
 * Source files are added to the build scripts from the `${workspaceFolder}/build/app/myapp` directory.
 * For example, the application is compiled in `${workspaceFolder}/bin/myapp/debug`
 
If you compile such a code and the compiler throws an error, the terminal will say for example:

`../../../build/app/myapp/main.c:10:5: Some error message.`

This file will not be clickable in the terminal because `${workspaceFolder}/build/app/myapp` is excluded from the search. 


## Extension Settings

The following settings causes the file will be opened at `${workspaceFolder}/src/myapp/main.c:10:5`

Add the following settings to your `${workspaceFolder}.vscode/settings.json`:


```JSON
"overwriteTerminalFileLink" :
{
    "overwrite" : {
        "^(\\.\\.\/)*build\\/app": "src" 
    },
    "fileLineColPatterns" : [
        {
            // VC++ - 'path/to/file.c(123): message'
            "pattern": "(^.*)\\((\\d+)\\):\\s.*$",
            "file": 1,
            "line": 2
        },
        {
            // gcc - 'path/to/file.c:123:13: message'
            "pattern": "(^.*):(\\d+):(\\d+):\\s?.*$",
            "file": 1,
            "line": 2,
            "col": 3
        }
    ]
}
```

## Release Notes

### 1.0.0

Initial release of Overwrite Terminal File Link.
