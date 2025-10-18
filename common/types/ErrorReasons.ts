enum ErrorReasons {
    NOT_EXIST = "NOT_EXIST", // 不存在
    PASSWORD_ERROR = "PASSWORD_ERROR", // 密码错误
    ASSERTION_ERROR = "ASSERTION_ERROR", // 断言错误
    RANGE_ERROR = "RANGE_ERROR", // 范围错误
    EMPTY_VALUE_ERROR = "EMPTY_VALUE_ERROR", // 空值错误
    INVALID_VALUE_ERROR = "INVALID_VALUE_ERROR", // 无效值错误
    UNKNOWN_ERROR = "UNKNOWN_ERROR", // 未知错误
    UNINITIALIZED_ERROR = "UNINITIALIZED_ERROR", // 未初始化错误
    TYPE_ERROR = "TYPE_ERROR", // 类型错误
    PROTOBUF_ERROR = "PROTOBUF_ERROR", // Protobuf验证/解析等错误
}

export default ErrorReasons;
