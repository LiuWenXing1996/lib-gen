import {
    type SFCDescriptor,
    type BindingMetadata,
    shouldTransformRef,
    transformRef,
    type CompilerOptions
} from '@vue/compiler-sfc'
import * as compiler from '@vue/compiler-sfc'
import hashId from 'hash-sum'
import { genSameNameFile } from '../command/build'
import { basename, extname } from 'node:path'

export const COMP_IDENTIFIER = `__sfc__`

export interface IOutputFile {
    filename: string,
    content: string
}

export interface ITransformResult {
    script: IOutputFile,
    styles: IOutputFile[]
}

export async function transformVueFile(
    code: string,
    config: {
        filename: string
    }
) {
    const res: ITransformResult = {
        script: {
            filename: "",
            content: ""
        },
        styles: []
    }

    const { filename } = config
    if (!filename.endsWith('.vue')) {
        return
    }
    if (!code.trim()) {
        return
    }
    const id = hashId(filename)
    const { errors, descriptor } = compiler.parse(code, {
        filename,
        sourceMap: true
    })
    if (errors.length) {
        throw errors[0]
    }

    const scriptLang =
        (descriptor.script && descriptor.script.lang) ||
        (descriptor.scriptSetup && descriptor.scriptSetup.lang)
    const isTS = scriptLang === 'ts'

    const hasScoped = descriptor.styles.some((s) => s.scoped)
    let clientCode = ''

    const appendSharedCode = (code: string) => {
        clientCode += code
    }

    const clientScriptResult = await doCompileScript(
        descriptor,
        id,
        isTS
    )
    if (!clientScriptResult) {
        return
    }
    const [clientScript, bindings] = clientScriptResult
    clientCode += clientScript

    // template
    // only need dedicated compilation if not using <script setup>
    if (
        descriptor.template &&
        (!descriptor.scriptSetup)
    ) {
        const clientTemplateResult = await doCompileTemplate(
            descriptor,
            id,
            bindings,
            isTS
        )
        if (!clientTemplateResult) {
            return
        }
        clientCode += clientTemplateResult
    }

    if (hasScoped) {
        appendSharedCode(
            `\n${COMP_IDENTIFIER}.__scopeId = ${JSON.stringify(`data-v-${id}`)}`
        )
    }

    if (clientCode) {
        appendSharedCode(
            `\n${COMP_IDENTIFIER}.__file = ${JSON.stringify(filename)}` +
            `\nexport default ${COMP_IDENTIFIER}`
        )
    }

    // styles
    let css = ''
    for (const style of descriptor.styles) {
        const lang = style.lang ? style.lang : 'css'
        if (style.module) {
            res.styles.push({
                filename: genSameNameFile(filename, `.module.${lang}`),
                content: style.content
            })
            return
        }

        const styleResult = await compiler.compileStyleAsync({
            source: style.content,
            filename,
            id,
            scoped: style.scoped,
            modules: !!style.module
        })
        if (styleResult.errors.length) {
            throw styleResult.errors[0]
        } else {
            css += styleResult.code + '\n'
        }
    }

    for (const style of res.styles) {
        const baseName = basename(style.filename)
        const extName = extname(style.filename)
        appendSharedCode(
            `\nimport "./${baseName}${extName}"`
        )
    }

    res.script.filename = genSameNameFile(filename, isTS ? ".ts" : ".js")
    res.script.content = clientCode.trimStart()

    return res
}

async function doCompileScript(
    descriptor: SFCDescriptor,
    id: string,
    isTS: boolean
): Promise<[string, BindingMetadata | undefined] | undefined> {
    if (descriptor.script || descriptor.scriptSetup) {
        const expressionPlugins: CompilerOptions['expressionPlugins'] = isTS
            ? ['typescript']
            : undefined
        const compiledScript = compiler.compileScript(descriptor, {
            inlineTemplate: true,
            id,
            templateOptions: {
                ssrCssVars: descriptor.cssVars,
                compilerOptions: {
                    expressionPlugins
                }
            }
        })
        let code = ''
        if (compiledScript.bindings) {
            code += `\n/* Analyzed bindings: ${JSON.stringify(
                compiledScript.bindings,
                null,
                2
            )} */`
        }
        code +=
            `\n` +
            compiler.rewriteDefault(
                compiledScript.content,
                COMP_IDENTIFIER,
                expressionPlugins
            )



        return [code, compiledScript.bindings]
    } else {
        return [`\nconst ${COMP_IDENTIFIER} = {}`, undefined]
    }
}

async function doCompileTemplate(
    descriptor: SFCDescriptor,
    id: string,
    bindingMetadata: BindingMetadata | undefined,
    isTS: boolean
) {
    const templateResult = compiler.compileTemplate({
        source: descriptor.template!.content,
        filename: descriptor.filename,
        id,
        scoped: descriptor.styles.some((s) => s.scoped),
        slotted: descriptor.slotted,
        ssrCssVars: descriptor.cssVars,
        isProd: false,
        compilerOptions: {
            bindingMetadata,
            expressionPlugins: isTS ? ['typescript'] : undefined
        }
    })
    if (templateResult.errors.length) {
        throw templateResult.errors[0]
    }

    const fnName = `render`

    let code =
        `\n${templateResult.code.replace(
            /\nexport (function|const) (render|ssrRender)/,
            `$1 ${fnName}`
        )}` + `\n${COMP_IDENTIFIER}.${fnName} = ${fnName}`

    return code
}
