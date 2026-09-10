package com.example.travel.service;

import com.example.travel.dto.LoginRequestDto;
import com.example.travel.dto.SignupRequestDto;
import com.example.travel.dto.UserDto;
import com.example.travel.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public void registerUser(SignupRequestDto request) {
        // 1. 이메일 중복 체크
        if (userMapper.existsByEmail(request.getEmail()) > 0) {
            throw new IllegalArgumentException("이미 사용 중인 이메일입니다.");
        }

        // 2. 비밀번호 암호화 및 UserDto 생성
        UserDto user = new UserDto();
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setNickname(request.getNickname());

        // 3. DB 저장
        userMapper.insertUser(user);
    }

    public UserDto login(LoginRequestDto request) {
        // 1. 이메일 존재 여부 확인 (MyBatis Mapper 사용)
        UserDto user = userMapper.findByEmail(request.getEmail());
        if (user == null) {
            throw new IllegalArgumentException("존재하지 않는 이메일입니다.");
        }

        // 2. 비밀번호 일치 여부 검증
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
        }

        // 3. 보안을 위해 반환 전 비밀번호 제거
        user.setPassword(null);

        return user;
    }
}