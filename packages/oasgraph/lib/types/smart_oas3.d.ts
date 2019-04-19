/**
 * Type definitions for the OpenAPI Specification 3 SmartAPI Extension.
 */
import * as OAS3 from './oas3';
export declare type SmartOperationObject = OAS3.OperationObject & {
    schema: string;
    parameters?: SmartParameterObject[];
};
export declare type OperationParameterReference = {
    schema: string;
    path: string;
    method: string;
    name: string;
};
export declare type LabeledOas3 = {
    [label: string]: OAS3.Oas3;
};
export declare type ParameterValueTypes = {
    [valueType: string]: OperationParameterReference[];
};
export declare type SmartLinkObject = {
    'x-valueType'?: string;
    parameters?: {
        [key: string]: any;
    };
    requestBody?: any;
    description?: string;
};
export declare type SmartLinksObject = {
    [key: string]: OAS3.ReferenceObject & SmartLinkObject;
};
export declare type SmartResponseObject = OAS3.ResponseObject & {
    'x-links'?: SmartLinksObject;
    'x-responseValueType'?: string;
};
export declare type SmartParameterObject = OAS3.ParameterObject & {
    'x-parameterValueType'?: string;
};
