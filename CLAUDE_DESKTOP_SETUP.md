# NAVI - Configuración para Claude Desktop

## 📋 Instrucciones de Instalación

### 1. Verificar que NAVI esté construido
```bash
cd /Users/juanpablodiaz/my_projects/NAVI
npm run build
```

### 2. Probar que funciona
```bash
npm run test:mcp
```

### 3. Configurar Claude Desktop

Abre el archivo de configuración de Claude Desktop:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### 4. Agregar NAVI a la configuración

Agrega esta configuración a tu archivo `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "navi": {
      "command": "node",
      "args": [
        "/Users/juanpablodiaz/my_projects/NAVI/dist/index.js"
      ],
      "env": {
        "NODE_ENV": "production",
        "NAVI_LOG_LEVEL": "info",
        "NAVI_MAX_FILE_SIZE": "1048576",
        "NAVI_MAX_DEPTH": "10"
      }
    }
  }
}
```

### 5. Si ya tienes otros servidores MCP

Si ya tienes otros servidores configurados (como rixa, risa, etc.), simplemente agrega la sección `"navi"` dentro de `"mcpServers"`:

```json
{
  "mcpServers": {
    "rixa": {
      "command": "node",
      "args": [
        "/Users/juanpablodiaz/my_projects/RIXA/dist/index.js",
        "--stdio"
      ],
      "env": {
        "RIXA_AUTH_ENABLED": "false",
        "RIXA_FS_ALLOWED_PATHS": "/Users/juanpablodiaz/my_projects",
        "RIXA_LOG_LEVEL": "error",
        "RIXA_LOG_FILE": "/tmp/rixa.log"
      }
    },
    "navi": {
      "command": "node",
      "args": [
        "/Users/juanpablodiaz/my_projects/NAVI/dist/index.js"
      ],
      "env": {
        "NODE_ENV": "production",
        "NAVI_LOG_LEVEL": "info",
        "NAVI_MAX_FILE_SIZE": "1048576",
        "NAVI_MAX_DEPTH": "10"
      }
    },
    "risa": {
      "command": "node",
      "args": [
        "/Users/juanpablodiaz/my_projects/RISA/build/index.js"
      ],
      "env": {
        "NODE_ENV": "production",
        "RISA_LOG_LEVEL": "info"
      }
    }
  }
}
```

### 6. Reiniciar Claude Desktop

Después de guardar la configuración, reinicia Claude Desktop completamente.

## 🛠️ Herramientas Disponibles

Una vez configurado, tendrás acceso a estas herramientas en Claude Desktop:

### `generate-tree` ✅ FUNCIONAL
Genera visualización ASCII de la estructura de directorios.

**Ejemplo de uso en Claude:**
> "Genera un árbol ASCII del directorio src de mi proyecto"

**Parámetros disponibles:**
- `path`: Ruta del directorio (requerido)
- `maxDepth`: Profundidad máxima (default: 10)
- `includeHidden`: Incluir archivos ocultos (default: false)
- `extensions`: Filtrar por extensiones (ej: ["ts", "js"])
- `excludePatterns`: Patrones a excluir (ej: ["node_modules", "*.test.*"])
- `showSizes`: Mostrar tamaños de archivo (default: false)

### Herramientas Futuras (Placeholders)
- `analyze-dependencies`: Análisis de dependencias
- `semantic-search`: Búsqueda semántica de código
- `find-auth`: Descubrimiento de lógica de autenticación
- `visualize-graph`: Visualización de grafos de dependencias

## 🔧 Variables de Entorno

Puedes personalizar el comportamiento de NAVI con estas variables:

- `NAVI_LOG_LEVEL`: Nivel de logging (debug, info, warn, error)
- `NAVI_MAX_FILE_SIZE`: Tamaño máximo de archivo en bytes (default: 1048576)
- `NAVI_MAX_DEPTH`: Profundidad máxima de traversal (default: 10)
- `NAVI_EXCLUDE_PATTERNS`: Patrones adicionales a excluir (separados por coma)

## 🧪 Verificación

Para verificar que NAVI está funcionando correctamente:

1. **Desde terminal:**
```bash
cd /Users/juanpablodiaz/my_projects/NAVI
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npm start
```

2. **En Claude Desktop:**
Pregunta: "¿Qué herramientas MCP tienes disponibles?" y deberías ver NAVI listado.

3. **Probar generate-tree:**
Pregunta: "Usa NAVI para generar un árbol del directorio src"

## 🐛 Solución de Problemas

### Error: "Cannot find module"
- Verifica que el path en la configuración sea correcto
- Asegúrate de que `npm run build` se ejecutó correctamente

### Error: "Server failed to start"
- Revisa los logs de Claude Desktop
- Verifica que Node.js esté instalado y accesible
- Comprueba que no haya errores de sintaxis en el JSON de configuración

### NAVI no aparece en las herramientas
- Reinicia Claude Desktop completamente
- Verifica que la configuración JSON esté bien formateada
- Revisa que no haya comas extra o faltantes en el JSON

## 📝 Ejemplo de Configuración Completa

Aquí tienes un ejemplo de configuración completa que incluye NAVI junto con otros servidores MCP:

```json
{
  "mcpServers": {
    "navi": {
      "command": "node",
      "args": ["/Users/juanpablodiaz/my_projects/NAVI/dist/index.js"],
      "env": {
        "NODE_ENV": "production",
        "NAVI_LOG_LEVEL": "info"
      }
    }
  }
}
```

¡Listo! NAVI debería estar disponible en Claude Desktop para explorar y visualizar la estructura de tus proyectos.
