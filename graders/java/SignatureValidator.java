import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;

import java.io.*;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class SignatureValidator {

    private static File paramsFile = new File("/grade/tests/signatureValidation.json");
    private static File resultsFile = new File("/grade/results/results.json");


    public static void writeExceptionToResult(Throwable t) {
        JSONObject results = new JSONObject();
        results.put("gradable", false);
        results.put("message", "Student code validation error:\n" + t.toString());
        try (FileWriter writer = new FileWriter(resultsFile)) {
            writer.write(results.toString());
        } catch (IOException e) {
            e.printStackTrace();
        }
        System.exit(1);
    }

    public static void main(String[] args) {
        JSONObject paramsObject = null;
        try (Reader reader = new FileReader(paramsFile)) {
            JSONParser paramsParser = new JSONParser();
            paramsObject = (JSONObject) paramsParser.parse(reader);
        } catch (Exception e) {
            writeExceptionToResult(e);
        } finally {
            paramsFile.delete();
        }

        try {
            JSONArray classes = (JSONArray) paramsObject.get("classes");
            for (Object classDefinition : classes) {
                validateClass((JSONObject) classDefinition);
            }
        } catch (Exception e) {
            writeExceptionToResult(e);
        }
    }

    private static void validateClass(JSONObject classDefinition) throws Exception {
        String className = (String) classDefinition.get("name");
        Class studentClass = null;
        try {
            studentClass = Class.forName(className);
        } catch (ClassNotFoundException e) {
            throw new Exception("Class " + className + " was not found.\nMake sure this class has been properly " +
                    "implemented and named, and that the package declaration is correctly specified.");
        }
        validateClass("Class " + className, classDefinition, studentClass);
    }

    private static void validateClass(String prefix, JSONObject classDefinition, Class studentClass) throws Exception {
        validateModifiers(prefix, classDefinition.get("modifiers"), studentClass.getModifiers());
        validateMethods(prefix, (JSONArray) classDefinition.get("methods"), studentClass.getMethods());
        // TODO Validate parent class
        // TODO Validate interfaces
        // TODO Validate subclasses
        // TODO Validate properties
        // TODO Validate annotations?
        // TODO Validate generics?
    }

    private static boolean hasModifier(String modifierText, int modifiers) {
        switch (modifier.toString()) {
            case "public":
                return Modifier.isPublic(modifiers);
            case "private":
                return Modifier.isPrivate(modifiers);
            case "protected":
                return Modifier.isProtected(modifiers);
            case "static":
                return Modifier.isStatic(modifiers);
            case "final":
                return Modifier.isFinal(modifiers);
            case "synchronized":
                return Modifier.isSynchronized(modifiers);
            case "volatile":
                return Modifier.isVolatile(modifiers);
            case "transient":
                return Modifier.isTransient(modifiers);
            case "interface":
                return Modifier.isInterface(modifiers);
            case "abstract":
                return Modifier.isAbstract(modifiers);
        }
        throw new IllegalArgumentException(modifierText + " is not a valid modifier.");
    }

    private static void validateModifiers(String prefix, Object requiredModifiers, int modifiers) {
        if (requiredModifiers == null)
            return;
        for (Object modifier : (JSONArray) requiredModifiers) {
            if (!hasModifier(modifier.toString(), modifiers)) {
                throw new RuntimeException(prefix + ": Missing modifier '" + modifier.toString() + "'");
            }
        }
    }

    private static void validateMethods(String prefix, JSONArray requiredMethods, Method[] methods) {
        if (requiredMethods == null)
            return;
        for (Object methodObj : requiredMethods) {
            JSONObject methodInfo = (JSONObject) methodObj;
            String methodName = (String) methodInfo.get("name");
            List<Method> matchingMethods = Stream.of(methods).filter((method -> method.getName().equals(methodName))).collect(Collectors.toList());
            if (matchingMethods.isEmpty())
                throw new RuntimeException(prefix + ": method with name " + methodName + " could not be found.");
            List<String> exceptionCollection = new ArrayList<>();
            boolean foundValidMethod = false;
            String methodPrefix = prefix + ", method " + methodName;
            for (int i = 0; i < matchingMethods.size(); i++) {
                Method method = matchingMethods.get(i);
                try {
                    String overloadMethodPrefix = methodPrefix + (matchingMethods.size() > 1 ? " (overload " + i + ")" : "");
                    validateModifiers(overloadMethodPrefix, methodInfo.get("modifiers"), method.getModifiers());
                    // TODO Validate parameters
                    // TODO Validate exceptions
                    // TODO Validate return type
                    // TODO Validate annotations?
                    // TODO Validate generics?
                    foundValidMethod = true;
                } catch (RuntimeException e) {
                    if (matchingMethods.size() == 1)
                        throw e;
                    exceptionCollection.add(e.toString());
                }
            }
            if (!foundValidMethod) {
                throw new RuntimeException(methodPrefix + ": Could not find a matching method.\n" + String.join("\n", exceptionCollection));
            }
        }
    }
}
