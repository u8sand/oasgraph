// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: oasgraph
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

/**
 * Type definitions for the OpenAPI Specification 3 SmartAPI Extension.
 */

import * as OAS3 from './oas3'

export type SmartOperationObject = OAS3.OperationObject & {
  schema: string,
  parameters?: SmartParameterObject[]
}

export type OperationParameterReference = {
  schema: string,
  path: string,
  method: string,
  name: string,
}

export type LabeledOas3 = {
  [label: string]: OAS3.Oas3
}

export type ParameterValueTypes = {
  [valueType: string]: OperationParameterReference[]
}

export type SmartLinkObject = {
  'x-valueType'?: string,
  parameters?: {
    [key: string]: any
  },
  requestBody?: any,
  description?: string,
}

export type SmartLinksObject = {
  [key: string]: OAS3.ReferenceObject & SmartLinkObject
}

export type SmartResponseObject = OAS3.ResponseObject & {
  'x-links'?: SmartLinksObject,
  'x-responseValueType'?: string,
}

export type SmartParameterObject = OAS3.ParameterObject & {
  'x-parameterValueType'?: string,
}
