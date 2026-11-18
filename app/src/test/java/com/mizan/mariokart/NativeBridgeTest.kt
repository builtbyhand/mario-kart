package com.mizan.mariokart

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for production bridge utilities (InputBridgeUtils).
 * Tests actual production serialization, parsing, and sensor math.
 */
class NativeBridgeTest {

    @Test
    fun testGamepadStateJsonFormatting() {
        val json = InputBridgeUtils.formatGamepadJson(
            steer = -0.75f,
            gas = true,
            brake = false,
            drift = true,
            item = false
        )

        // Parse with JSONObject to verify valid JSON syntax and exact schema
        val parsed = JSONObject(json)
        assertEquals(-0.75, parsed.getDouble("steer"), 0.001)
        assertTrue(parsed.getBoolean("gas"))
        assertFalse(parsed.getBoolean("brake"))
        assertTrue(parsed.getBoolean("drift"))
        assertFalse(parsed.getBoolean("item"))
    }

    @Test
    fun testGamepadStateAllReleased() {
        val json = InputBridgeUtils.formatGamepadJson(
            steer = 0.0f,
            gas = false,
            brake = false,
            drift = false,
            item = false
        )

        val parsed = JSONObject(json)
        assertEquals(0.0, parsed.getDouble("steer"), 0.001)
        assertFalse(parsed.getBoolean("gas"))
        assertFalse(parsed.getBoolean("brake"))
        assertFalse(parsed.getBoolean("drift"))
        assertFalse(parsed.getBoolean("item"))
    }

    @Test
    fun testSensorRollAndPitchMath() {
        // Landscape accelerometer conversion (9.0f multiplier)
        val rollZero = InputBridgeUtils.computeRollDegrees(0.0f)
        assertEquals(0.0f, rollZero, 0.001f)

        val rollRight = InputBridgeUtils.computeRollDegrees(2.5f)
        assertEquals(22.5f, rollRight, 0.001f)

        val rollLeft = InputBridgeUtils.computeRollDegrees(-3.0f)
        assertEquals(-27.0f, rollLeft, 0.001f)

        val pitchForward = InputBridgeUtils.computePitchDegrees(-1.2f)
        assertEquals(-10.8f, pitchForward, 0.001f)
    }

    @Test
    fun testVibrationPatternJsonParsing() {
        val patternJson = "[0, 50, 100, 150]"
        val timings = InputBridgeUtils.parseVibrationPattern(patternJson)

        assertEquals(4, timings.size)
        assertEquals(0L, timings[0])
        assertEquals(50L, timings[1])
        assertEquals(100L, timings[2])
        assertEquals(150L, timings[3])
    }

    @Test
    fun testEmptyVibrationPattern() {
        val emptyJson = "[]"
        val timings = InputBridgeUtils.parseVibrationPattern(emptyJson)
        assertEquals(0, timings.size)
    }
}
